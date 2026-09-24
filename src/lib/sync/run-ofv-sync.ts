import {
  createVehicleRequest,
  getOfvStatus,
  paginateVehicleResults,
} from "@/lib/ofv/client";
import {
  defaultRegistrationSyncFrom,
  NEW_REGISTRATION_FILTERS,
  OFV_PAGE_SIZE,
  OFV_SYNC_FIELDS,
  TRUCK_FILTERS,
} from "@/lib/ofv/constants";
import {
  vehicleToPopulationRows,
  vehicleToRegistrationRows,
} from "@/lib/ofv/transform";
import { createAdminClient } from "@/lib/supabase/admin-core";
import { captureTmfRenewalSnapshot } from "@/lib/tmf/renewal-snapshot";

const UPSERT_BATCH_SIZE = 200;
/** Batch-størrelse for DELETE av stale/gamle population-rader (unngår statement_timeout). */
const POPULATION_DELETE_BATCH_SIZE = 2000;
const SYNC_LOCK_MAX_AGE_MS = 20 * 60 * 1000;

type SyncScope = "full" | "registrations" | "population";

interface SyncOptions {
  scope?: SyncScope;
  force?: boolean;
  registrationsFrom?: string;
  registrationsTo?: string;
}

interface SyncResult {
  skipped: boolean;
  reason?: string;
  dataVersion?: number;
  publishDate?: string;
  registrations?: { fetched: number; upserted: number };
  population?: { fetched: number; upserted: number };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function startSyncLog(
  syncType: "registrations" | "population" | "full",
  dataVersion: number,
  publishDate: string,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sync_logs")
    .insert({
      sync_type: syncType,
      status: "running",
      ofv_data_version: dataVersion,
      ofv_publish_date: publishDate,
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
    console.error("finishSyncLog feilet:", error.message);
  }
}

async function hasCompletedSyncForVersion(dataVersion: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sync_logs")
    .select("id")
    .eq("ofv_data_version", dataVersion)
    .eq("sync_type", "full")
    .eq("status", "completed")
    .limit(1);

  return (data?.length ?? 0) > 0;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Sletter population-rader i små batches for å unngå statement_timeout
 * på store DELETE-er (én snapshot ~65k rader; tabellen kan være større
 * etter mislykkede synker).
 */
async function deletePopulationInBatches(
  supabase: AdminClient,
  filter: { snapshotDate: string; syncedBefore?: string },
): Promise<number> {
  let totalDeleted = 0;

  for (;;) {
    let query = supabase
      .from("population")
      .select("id")
      .eq("snapshot_date", filter.snapshotDate)
      .limit(POPULATION_DELETE_BATCH_SIZE);

    if (filter.syncedBefore) {
      query = query.lt("synced_at", filter.syncedBefore);
    }

    const { data: rows, error: selectError } = await query;
    if (selectError) {
      throw new Error(
        `Populasjonsopprydding (select) feilet: ${selectError.message}`,
      );
    }
    if (!rows?.length) break;

    const ids = rows.map((r) => r.id);
    const { error: deleteError } = await supabase
      .from("population")
      .delete()
      .in("id", ids);

    if (deleteError) {
      throw new Error(
        `Populasjonsopprydding (delete) feilet: ${deleteError.message}`,
      );
    }

    totalDeleted += ids.length;
    if (ids.length < POPULATION_DELETE_BATCH_SIZE) break;
  }

  return totalDeleted;
}

/** Fjerner alle snapshots eldre enn det nettopp synkede. */
async function pruneOldPopulationSnapshots(
  supabase: AdminClient,
  keepSnapshotDate: string,
): Promise<void> {
  for (;;) {
    const { data, error } = await supabase
      .from("population")
      .select("snapshot_date")
      .lt("snapshot_date", keepSnapshotDate)
      .order("snapshot_date", { ascending: true })
      .limit(1);

    if (error) {
      console.error("pruneOldPopulationSnapshots select feilet:", error.message);
      return;
    }
    if (!data?.length) return;

    try {
      await deletePopulationInBatches(supabase, {
        snapshotDate: data[0].snapshot_date,
      });
    } catch (err) {
      console.error(
        `pruneOldPopulationSnapshots ${data[0].snapshot_date} feilet:`,
        err instanceof Error ? err.message : err,
      );
      return;
    }
  }
}

async function assertNoSyncRunning(): Promise<void> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - SYNC_LOCK_MAX_AGE_MS).toISOString();
  const { data } = await supabase
    .from("sync_logs")
    .select("id, sync_type")
    .eq("status", "running")
    .gte("started_at", cutoff)
    .limit(1);

  if (data?.[0]) {
    throw new Error(
      `En ${data[0].sync_type}-synk kjører allerede. Vent til den er ferdig.`,
    );
  }
}

async function getLatestRegistrationFrom(): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("registrations")
    .select("transaction_time")
    .order("transaction_time", { ascending: false })
    .limit(1);

  if (data?.[0]?.transaction_time) {
    return data[0].transaction_time;
  }

  return defaultRegistrationSyncFrom();
}

async function syncRegistrations(
  dataVersion: number,
  fromTime: string,
  toTime: string,
  publishDate: string,
): Promise<{ fetched: number; upserted: number }> {
  const supabase = createAdminClient();
  const logId = await startSyncLog("registrations", dataVersion, publishDate);

  let fetched = 0;
  let upserted = 0;

  try {
    const { handle } = await createVehicleRequest({
      fields: [...OFV_SYNC_FIELDS],
      filters: {
        vehicleTypeIds: [...NEW_REGISTRATION_FILTERS.vehicleTypeIds],
        transactionTypeIds: [...NEW_REGISTRATION_FILTERS.transactionTypeIds],
      },
      transactions: {
        fromTransactionTime: fromTime,
        toTransactionTime: toTime,
      },
    });

    for await (const page of paginateVehicleResults(handle, OFV_PAGE_SIZE)) {
      const rows = page.vehicles.flatMap((vehicle) =>
        vehicleToRegistrationRows(vehicle, dataVersion),
      );
      fetched += rows.length;

      for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
        const { error } = await supabase.from("registrations").upsert(batch, {
          onConflict: "registration_number,transaction_time,transaction_type_id",
        });
        if (error) throw new Error(error.message);
        upserted += batch.length;
      }
    }

    await finishSyncLog(logId, "completed", fetched, upserted);
    return { fetched, upserted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    await finishSyncLog(logId, "failed", fetched, upserted, message);
    throw error;
  }
}

async function syncPopulation(
  dataVersion: number,
  snapshotDate: string,
): Promise<{ fetched: number; upserted: number }> {
  const supabase = createAdminClient();
  const logId = await startSyncLog("population", dataVersion, snapshotDate);
  const syncMarker = new Date().toISOString();

  let fetched = 0;
  let upserted = 0;

  try {
    const { handle } = await createVehicleRequest({
      fields: [...OFV_SYNC_FIELDS],
      filters: {
        vehicleTypeIds: [...TRUCK_FILTERS.vehicleTypeIds],
      },
      population: { populationDate: `${snapshotDate}T00:00:00` },
    });

    for await (const page of paginateVehicleResults(handle, OFV_PAGE_SIZE)) {
      const rows = page.vehicles.flatMap((vehicle) =>
        vehicleToPopulationRows(vehicle, snapshotDate, dataVersion),
      );
      fetched += rows.length;

      for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
        const stamped = batch.map((row) => ({
          ...row,
          synced_at: syncMarker,
        }));
        const { error } = await supabase.from("population").upsert(stamped, {
          onConflict: "registration_number,snapshot_date",
        });
        if (error) throw new Error(error.message);
        upserted += batch.length;
      }
    }

    // Slett stale rader for dette snapshotet i batches (én stor DELETE timer ut).
    await deletePopulationInBatches(supabase, {
      snapshotDate,
      syncedBefore: syncMarker,
    });

    // Behold kun siste snapshot – ellers vokser tabellen ved mislykkede synker.
    await pruneOldPopulationSnapshots(supabase, snapshotDate);

    // Månedlig fornyelsesaggregat til fremtidig kalibrering (fail-soft).
    await captureTmfRenewalSnapshot({ populationDate: snapshotDate });

    await finishSyncLog(logId, "completed", fetched, upserted);
    return { fetched, upserted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    await finishSyncLog(logId, "failed", fetched, upserted, message);
    throw error;
  }
}

export async function runOfvSync(options: SyncOptions = {}): Promise<SyncResult> {
  const scope = options.scope ?? "full";
  await assertNoSyncRunning();

  const status = await getOfvStatus();
  const publishDate = status.publishDate.slice(0, 10);
  const toTime = new Date().toISOString();

  if (!options.force && scope === "full") {
    const alreadySynced = await hasCompletedSyncForVersion(status.dataVersion);
    if (alreadySynced) {
      return {
        skipped: true,
        reason: `dataVersion ${status.dataVersion} er allerede synket`,
        dataVersion: status.dataVersion,
        publishDate,
      };
    }
  }

  const fullLogId =
    scope === "full"
      ? await startSyncLog("full", status.dataVersion, publishDate)
      : null;

  let registrationsResult: { fetched: number; upserted: number } | undefined;
  let populationResult: { fetched: number; upserted: number } | undefined;
  let partialFetched = 0;
  let partialUpserted = 0;

  try {
    if (scope === "full" || scope === "population") {
      populationResult = await syncPopulation(status.dataVersion, publishDate);
      partialFetched += populationResult.fetched;
      partialUpserted += populationResult.upserted;
    }

    if (scope === "full" || scope === "registrations") {
      const fromTime =
        options.registrationsFrom ?? (await getLatestRegistrationFrom());
      const regToTime = options.registrationsTo ?? toTime;
      registrationsResult = await syncRegistrations(
        status.dataVersion,
        fromTime,
        regToTime,
        publishDate,
      );
      partialFetched += registrationsResult.fetched;
      partialUpserted += registrationsResult.upserted;
    }

    if (fullLogId) {
      await finishSyncLog(
        fullLogId,
        "completed",
        partialFetched,
        partialUpserted,
      );
    }

    return {
      skipped: false,
      dataVersion: status.dataVersion,
      publishDate,
      registrations: registrationsResult,
      population: populationResult,
    };
  } catch (error) {
    if (fullLogId) {
      const message = error instanceof Error ? error.message : "Ukjent feil";
      await finishSyncLog(
        fullLogId,
        "failed",
        partialFetched,
        partialUpserted,
        message,
      );
    }
    throw error;
  }
}

/** Hent og lagre nyregistreringer for et eksplisitt tidsrom (f.eks. historisk backfill). */
export async function backfillRegistrationsRange(
  fromTime: string,
  toTime: string,
): Promise<{ fetched: number; upserted: number; dataVersion: number }> {
  const status = await getOfvStatus();
  const publishDate = status.publishDate.slice(0, 10);
  const result = await syncRegistrations(
    status.dataVersion,
    fromTime,
    toTime,
    publishDate,
  );
  return { ...result, dataVersion: status.dataVersion };
}
