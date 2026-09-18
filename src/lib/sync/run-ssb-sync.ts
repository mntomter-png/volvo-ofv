import { fetchTableData } from "@/lib/ssb/client";
import { getUniqueSsbFetchRequests } from "@/lib/ssb/indicators";
import { extractIndicatorRows } from "@/lib/ssb/parser";
import type { SsbIndicatorRow, SsbSyncResult } from "@/lib/ssb/types";
import { createAdminClient } from "@/lib/supabase/admin-core";

const UPSERT_BATCH_SIZE = 200;
const SSB_REQUEST_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function startSyncLog() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sync_logs")
    .insert({
      sync_type: "ssb",
      status: "running",
      metadata: { source: "ssb_pxwebapi_v2" },
    })
    .select("id")
    .single();

  if (error) throw new Error(`Kunne ikke opprette sync_log: ${error.message}`);
  return data.id;
}

async function finishSyncLog(
  id: string,
  status: "completed" | "failed",
  fetched: number,
  upserted: number,
  errorMessage?: string,
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sync_logs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      records_fetched: fetched,
      records_upserted: upserted,
      error_message: errorMessage ?? null,
    })
    .eq("id", id);

  if (error) {
    console.error("Kunne ikke oppdatere sync_log:", error.message);
  }
}

async function upsertIndicators(rows: SsbIndicatorRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = createAdminClient();
  let upserted = 0;
  const syncedAt = new Date().toISOString();

  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from("ssb_indicators").upsert(
      batch.map((row) => ({
        indicator_key: row.indicator_key,
        label: row.label,
        period: row.period,
        value: row.value,
        unit: row.unit,
        tmf_driver: row.tmf_driver,
        ssb_table_id: row.ssb_table_id,
        synced_at: syncedAt,
      })),
      { onConflict: "indicator_key,period" },
    );

    if (error) throw new Error(`Kunne ikke lagre SSB-indikatorer: ${error.message}`);
    upserted += batch.length;
  }

  return upserted;
}

function currentSnapshotMonth(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}-01`;
}

/**
 * Tar vare på hva vi vet om SSB denne måneden, før senere revisjoner skriver
 * over `ssb_indicators`. Gjentatte synker samme måned overskriver hverandre, så
 * snapshotet speiler siste kjøring i måneden.
 */
async function captureSnapshot(rows: SsbIndicatorRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = createAdminClient();
  const snapshotMonth = currentSnapshotMonth();
  let captured = 0;

  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from("ssb_indicator_snapshots").upsert(
      batch.map((row) => ({
        snapshot_month: snapshotMonth,
        indicator_key: row.indicator_key,
        period: row.period,
        value: row.value,
        tmf_driver: row.tmf_driver,
      })),
      { onConflict: "snapshot_month,indicator_key,period" },
    );

    if (error) {
      // Snapshot er for fremtidig backtest, ikke for den levende prognosen.
      // En feil her skal ikke velte SSB-synken.
      console.error("Kunne ikke lagre SSB-øyeblikksbilde:", error.message);
      return captured;
    }
    captured += batch.length;
  }

  return captured;
}

export async function runSsbSync(): Promise<SsbSyncResult> {
  const requests = getUniqueSsbFetchRequests();
  const allRows: SsbIndicatorRow[] = [];
  let logId: string | null = null;

  try {
    logId = await startSyncLog();

    let first = true;
    for (const request of requests) {
      if (!first) await sleep(SSB_REQUEST_DELAY_MS);
      first = false;

      const dataset = await fetchTableData(request.tableId, request.valuecodes);

      for (const source of request.sources) {
        allRows.push(...extractIndicatorRows(dataset, source));
      }
    }

    const upserted = await upsertIndicators(allRows);
    await captureSnapshot(allRows);

    if (logId) {
      await finishSyncLog(logId, "completed", allRows.length, upserted);
    }

    return {
      skipped: false,
      indicators: { fetched: allRows.length, upserted },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    if (logId) {
      await finishSyncLog(logId, "failed", allRows.length, 0, message);
    }
    throw error;
  }
}
