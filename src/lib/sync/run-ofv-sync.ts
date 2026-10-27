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
import {
  POPULATION_PRUNE_LOG_KIND,
  formatPopulationPruneError,
  isMissingPopulationPruneRpc,
} from "@/lib/sync/population-prune";
import { scheduleFullPopulationExport } from "@/lib/sync/schedule-population-export";
import {
  buildSkipLogInsert,
  buildSkipLogRefresh,
  isUniqueViolation,
  planSkipWrite,
  syncSkipMessage,
  type SyncSkipReasonCode,
  type SyncSkipTarget,
} from "@/lib/sync/skip-log";
import { createAdminClient } from "@/lib/supabase/admin-core";
import { captureTmfRenewalSnapshot } from "@/lib/tmf/renewal-snapshot";

/**
 * 50 rader per upsert. authenticator (og dermed service_role via SET ROLE)
 * har statement_timeout 8s. GIN-indeksene på navn har fastupdate=off slik at
 * en pending-list-flush ikke sprenger det taket. Mindre batch gir flere
 * HTTP-kall og kan sprenge Netlify-grensen (~15 min) på ~65k rader.
 */
const UPSERT_BATCH_SIZE = 50;
/** Batch-størrelse for DELETE av stale/gamle population-rader (unngår statement_timeout). */
const POPULATION_DELETE_BATCH_SIZE = 500;
/** Samme terskel som prune_incomplete_population_snapshots / watchdog. */
const COMPLETE_POPULATION_MIN_ROWS = 55000;
/** Hvert RPC-kall commiter. Flere kall tømmer en oppblåst tabell før upsert. */
const PRUNE_RPC_ATTEMPTS = 4;
const PRUNE_RPC_MAX_SECONDS = 45;
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

async function recordSyncSkip(input: {
  syncType: SyncSkipTarget;
  dataVersion: number;
  publishDate: string;
  code: SyncSkipReasonCode;
}): Promise<void> {
  const supabase = createAdminClient();
  const checkedAt = new Date().toISOString();
  const refresh = buildSkipLogRefresh({ ...input, checkedAt });

  async function latestSkip() {
    const { data, error } = await supabase
      .from("sync_logs")
      .select("id, ofv_data_version, metadata")
      .eq("sync_type", input.syncType)
      .eq("status", "skipped")
      .eq("ofv_data_version", input.dataVersion)
      .contains("metadata", { kind: "skip", reason: input.code })
      .order("completed_at", { ascending: false })
      .limit(1);
    if (error) {
      throw new Error(`Kunne ikke lese skip-logg: ${error.message}`);
    }
    return data?.[0] ?? null;
  }

  async function refreshSkip(id: string) {
    const { error } = await supabase
      .from("sync_logs")
      .update(refresh)
      .eq("id", id);
    if (error) {
      throw new Error(`Kunne ikke oppdatere skip-logg: ${error.message}`);
    }
  }

  const existing = await latestSkip();
  if (planSkipWrite(existing, input.code, input.dataVersion) === "update") {
    if (!existing) {
      throw new Error("Skip-logg skulle oppdateres, men raden mangler");
    }
    await refreshSkip(existing.id);
    return;
  }

  const { error: insertError } = await supabase
    .from("sync_logs")
    .insert(buildSkipLogInsert({ ...input, checkedAt }));

  if (!insertError) return;
  if (!isUniqueViolation(insertError)) {
    throw new Error(`Kunne ikke skrive skip-logg: ${insertError.message}`);
  }

  // Parallell sjekk rakk å sette inn samme versjon. Oppdater den raden.
  const winner = await latestSkip();
  if (!winner) {
    throw new Error("Skip-logg finnes, men kunne ikke oppdateres");
  }
  await refreshSkip(winner.id);
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

async function recordPopulationPruneFailure(
  supabase: AdminClient,
  message: string,
): Promise<void> {
  const errorMessage = formatPopulationPruneError(message);
  console.error(errorMessage);
  const { error } = await supabase.from("sync_logs").insert({
    sync_type: "population",
    status: "failed",
    completed_at: new Date().toISOString(),
    records_fetched: 0,
    records_upserted: 0,
    error_message: errorMessage,
    metadata: { kind: POPULATION_PRUNE_LOG_KIND },
  });
  if (error) {
    console.error("Kunne ikke logge populasjonsopprydding:", error.message);
  }
}

/**
 * Sletter eldre bestandsversjoner via security definer-funksjonen, som
 * hever statement_timeout for kallet og commiter per forsøk.
 *
 * Kalles etter vellykket upsert, og etter rollback når upserten feiler.
 * Ikke før upsert: en feilet re-synk sletter snapshot-datoen den rakk å
 * skrive, og da må forrige komplette versjon fortsatt ligge igjen.
 *
 * `legacyKeepSnapshotDate` brukes bare hvis funksjonen ikke finnes ennå
 * (migrasjonen er ikke kjørt). Da sletter vi eldre enn den datoen via API,
 * samme som før, men feil skrives til sync_logs.
 */
async function pruneSurplusPopulationSnapshots(
  supabase: AdminClient,
  legacyKeepSnapshotDate: string | null,
): Promise<void> {
  for (let attempt = 0; attempt < PRUNE_RPC_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.rpc(
      "prune_surplus_population_snapshots",
      {
        p_min_rows: COMPLETE_POPULATION_MIN_ROWS,
        p_max_seconds: PRUNE_RPC_MAX_SECONDS,
      },
    );

    if (error) {
      if (isMissingPopulationPruneRpc(error)) {
        console.warn(
          "prune_surplus_population_snapshots er ikke tilgjengelig. Kjør migrasjonen for selvhelende opprydding.",
        );
        if (legacyKeepSnapshotDate) {
          await legacyPruneOlderThan(supabase, legacyKeepSnapshotDate);
        }
        return;
      }
      await recordPopulationPruneFailure(supabase, error.message);
      return;
    }

    const deleted = typeof data === "number" ? data : 0;
    if (deleted <= 0) return;
  }
}

/** Fallback når DB-funksjonen ikke er deployet. Logger feil til sync_logs. */
async function legacyPruneOlderThan(
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
      await recordPopulationPruneFailure(
        supabase,
        `select av gammel bestandsversjon feilet: ${error.message}`,
      );
      return;
    }
    const oldest = data?.[0];
    if (!oldest) return;

    try {
      await deletePopulationInBatches(supabase, {
        snapshotDate: oldest.snapshot_date,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "ukjent feil";
      await recordPopulationPruneFailure(
        supabase,
        `sletting av bestandsversjon ${oldest.snapshot_date} feilet: ${message}`,
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
    await pruneSurplusPopulationSnapshots(supabase, snapshotDate);

    // Månedlig fornyelsesaggregat til fremtidig kalibrering (fail-soft).
    await captureTmfRenewalSnapshot({ populationDate: snapshotDate });

    await finishSyncLog(logId, "completed", fetched, upserted);
    await scheduleFullPopulationExport();
    return { fetched, upserted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    // Fjern ufullstendig snapshot slik at UI ikke hopper til max(snapshot_date)
    // med ~halv bestand (appen leser alltid nyeste snapshot-dato).
    if (upserted > 0) {
      try {
        await deletePopulationInBatches(supabase, { snapshotDate });
      } catch (cleanupErr) {
        const cleanupMessage =
          cleanupErr instanceof Error ? cleanupErr.message : "ukjent feil";
        await recordPopulationPruneFailure(
          supabase,
          `kunne ikke rulle tilbake ufullstendig snapshot ${snapshotDate}: ${cleanupMessage}`,
        );
      }
    }
    // Rydd eldre versjoner selv om denne upserten feilet.
    await pruneSurplusPopulationSnapshots(supabase, null);
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
      await recordSyncSkip({
        syncType: "full",
        dataVersion: status.dataVersion,
        publishDate,
        code: "already_synced",
      });
      return {
        skipped: true,
        reason: syncSkipMessage("already_synced", status.dataVersion),
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
