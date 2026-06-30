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
import { createAdminClient } from "@/lib/supabase/admin";

const UPSERT_BATCH_SIZE = 200;

type SyncScope = "full" | "registrations" | "population";

interface SyncOptions {
  scope?: SyncScope;
  force?: boolean;
  /** Hent registreringer fra denne datoen (ISO) i stedet for siste synkede rad. */
  registrationsFrom?: string;
  /** Valgfri øvre grense for registreringssynk (ISO). Standard er nå. */
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
  await supabase
    .from("sync_logs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      records_fetched: fetched,
      records_upserted: upserted,
      error_message: errorMessage ?? null,
    })
    .eq("id", id);
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
): Promise<{ fetched: number; upserted: number }> {
  const supabase = createAdminClient();
  const logId = await startSyncLog("registrations", dataVersion, toTime.slice(0, 10));

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

    await supabase.from("population").delete().eq("snapshot_date", snapshotDate);

    for await (const page of paginateVehicleResults(handle, OFV_PAGE_SIZE)) {
      const rows = page.vehicles.flatMap((vehicle) =>
        vehicleToPopulationRows(vehicle, snapshotDate, dataVersion),
      );
      fetched += rows.length;

      for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
        const { error } = await supabase.from("population").upsert(batch, {
          onConflict: "registration_number,snapshot_date",
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

export interface HistoricalBackfillYearResult {
  year: number;
  fetched: number;
  upserted: number;
}

export interface HistoricalBackfillResult {
  dataVersion: number;
  publishDate: string;
  years: HistoricalBackfillYearResult[];
  totalFetched: number;
  totalUpserted: number;
}

/** Henter nyregistreringer år for år (f.eks. 2020–2025) for datointervall-filtrering. */
export async function runHistoricalRegistrationBackfill(
  fromYear: number,
  toYear: number,
): Promise<HistoricalBackfillResult> {
  if (fromYear > toYear) {
    throw new Error(`fromYear (${fromYear}) kan ikke være større enn toYear (${toYear})`);
  }

  const status = await getOfvStatus();
  const publishDate = status.publishDate.slice(0, 10);
  const currentYear = new Date().getFullYear();
  const years: HistoricalBackfillYearResult[] = [];

  for (let year = fromYear; year <= toYear; year++) {
    const fromTime = `${year}-01-01T00:00:00`;
    const toTime =
      year >= currentYear
        ? new Date().toISOString()
        : `${year + 1}-01-01T00:00:00`;

    console.log(`Synker nyregistreringer for ${year} (${fromTime} → ${toTime})…`);
    const result = await syncRegistrations(status.dataVersion, fromTime, toTime);
    years.push({ year, ...result });
  }

  return {
    dataVersion: status.dataVersion,
    publishDate,
    years,
    totalFetched: years.reduce((sum, item) => sum + item.fetched, 0),
    totalUpserted: years.reduce((sum, item) => sum + item.upserted, 0),
  };
}

export async function runOfvSync(options: SyncOptions = {}): Promise<SyncResult> {
  const scope = options.scope ?? "full";
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

  const fullLogId = scope === "full"
    ? await startSyncLog("full", status.dataVersion, publishDate)
    : null;

  let registrationsResult: { fetched: number; upserted: number } | undefined;
  let populationResult: { fetched: number; upserted: number } | undefined;

  try {
    if (scope === "full" || scope === "population") {
      populationResult = await syncPopulation(status.dataVersion, publishDate);
    }

    if (scope === "full" || scope === "registrations") {
      const fromTime =
        options.registrationsFrom ?? (await getLatestRegistrationFrom());
      const registrationToTime = options.registrationsTo ?? toTime;
      registrationsResult = await syncRegistrations(
        status.dataVersion,
        fromTime,
        registrationToTime,
      );
    }

    if (fullLogId) {
      const fetched =
        (registrationsResult?.fetched ?? 0) + (populationResult?.fetched ?? 0);
      const upserted =
        (registrationsResult?.upserted ?? 0) + (populationResult?.upserted ?? 0);
      await finishSyncLog(fullLogId, "completed", fetched, upserted);
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
      await finishSyncLog(fullLogId, "failed", 0, 0, message);
    }
    throw error;
  }
}
