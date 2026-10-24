import { unstable_cache } from "next/cache";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";

import { getOfvStatus } from "@/lib/ofv/client";
import { createClient } from "@/lib/supabase/server";

export type SyncHealthStatus = "ok" | "warning" | "critical";

export type SyncHealthReason =
  | "ok"
  | "ofv_ahead"
  | "sync_delayed"
  | "sync_stale"
  | "stale_lock"
  | "ofv_unreachable"
  | "never_synced"
  | "population_incomplete"
  | "population_snapshots_excess"
  | "population_prune_failed";

export interface OfvSyncHealth {
  lastFullSyncAt: string | null;
  lastFullDataVersion: number | null;
  lastFullPublishDate: string | null;
  lastAnySyncAt: string | null;
  hoursSinceLastSync: number | null;
  staleRunningLocks: number;
  latestPopulationSnapshot: string | null;
  latestPopulationRows: number | null;
  populationIncomplete: boolean;
  /** Antall snapshot_date i population. 1 er normaltilstanden. */
  populationSnapshotCount: number;
  /** Siste uavklarte feil fra bestandsopprydding, ellers null. */
  populationPruneError: string | null;
  /** Siste bevisste skip (status skipped). Teller ikke som synk. */
  lastSkipAt: string | null;
  lastSkipDataVersion: number | null;
  lastSkipReason: string | null;
  /** Live OFV /status (cached). */
  ofvLivePublishDate: string | null;
  ofvLiveDataVersion: number | null;
  ofvStatusAvailable: boolean;
  /** True når live OFV-versjon er høyere enn synket. */
  ofvAhead: boolean;
  status: SyncHealthStatus;
  reason: SyncHealthReason;
}

interface OfvSyncHealthRow {
  last_full_sync_at: string | null;
  last_full_data_version: number | null;
  last_full_publish_date: string | null;
  last_any_sync_at: string | null;
  hours_since_last_sync: number | null;
  stale_running_locks: number | null;
  latest_population_snapshot: string | null;
  latest_population_rows: number | null;
  population_incomplete: boolean | null;
  population_snapshot_count?: number | null;
  population_prune_error?: string | null;
  last_skip_at?: string | null;
  last_skip_data_version?: number | null;
  last_skip_reason?: string | null;
}

/** Terskler: OFV publiserer typisk daglig; cron kjører 12:00 og 16:00 norsk tid. */
const OK_MAX_HOURS = 26;
const WARNING_MAX_HOURS = 50;

/** Cache OFV /status ~30 min for å unngå unødvendig API-last. */
const OFV_STATUS_REVALIDATE_SECONDS = 30 * 60;

const getCachedOfvStatus = unstable_cache(
  async () => {
    const status = await getOfvStatus();
    return {
      publishDate: status.publishDate.slice(0, 10),
      dataVersion: status.dataVersion,
    };
  },
  ["ofv-api-status"],
  { revalidate: OFV_STATUS_REVALIDATE_SECONDS },
);

export function resolveSyncHealth(
  hoursSinceLastSync: number | null,
  staleRunningLocks: number,
  ofvAhead: boolean,
  ofvStatusAvailable: boolean,
  populationIncomplete = false,
  populationSnapshotCount = 1,
  populationPruneError: string | null = null,
): { status: SyncHealthStatus; reason: SyncHealthReason } {
  const pruneError = populationPruneError?.trim()
    ? populationPruneError.trim()
    : null;

  if (populationIncomplete) {
    return { status: "critical", reason: "population_incomplete" };
  }
  if (staleRunningLocks > 0) {
    return { status: "warning", reason: "stale_lock" };
  }
  if (hoursSinceLastSync == null) {
    return { status: "critical", reason: "never_synced" };
  }
  if (hoursSinceLastSync > WARNING_MAX_HOURS) {
    return { status: "critical", reason: "sync_stale" };
  }
  // Opprydding og ekstra snapshots er årsaken til timeout-spiralen.
  // De vises foran «OFV er foran» når selve synken ellers er fersk.
  if (pruneError) {
    return { status: "warning", reason: "population_prune_failed" };
  }
  if (populationSnapshotCount > 1) {
    return { status: "warning", reason: "population_snapshots_excess" };
  }
  if (ofvAhead) {
    return { status: "warning", reason: "ofv_ahead" };
  }
  if (hoursSinceLastSync > OK_MAX_HOURS) {
    return { status: "warning", reason: "sync_delayed" };
  }
  if (!ofvStatusAvailable) {
    return { status: "warning", reason: "ofv_unreachable" };
  }
  return { status: "ok", reason: "ok" };
}

/** @deprecated Bruk resolveSyncHealth. Beholdes for enkle kall uten OFV-status. */
export function resolveSyncHealthStatus(
  hoursSinceLastSync: number | null,
  staleRunningLocks: number,
): SyncHealthStatus {
  return resolveSyncHealth(
    hoursSinceLastSync,
    staleRunningLocks,
    false,
    true,
  ).status;
}

export function syncHealthStatusLabel(
  status: SyncHealthStatus,
  reason?: SyncHealthReason,
): string {
  if (reason === "population_incomplete") return "Ufullstendig bestand";
  if (reason === "population_snapshots_excess") return "Flere bestandsversjoner";
  if (reason === "population_prune_failed") return "Bestandsopprydding feilet";
  if (reason === "ofv_ahead") return "Ny OFV-data";
  if (reason === "ofv_unreachable") return "OFV-status utilgjengelig";
  switch (status) {
    case "ok":
      return "Datasynk OK";
    case "warning":
      return "Datasynk forsinket";
    case "critical":
      return "Datasynk ute av drift";
  }
}

export function formatSyncTimestamp(iso: string | null): string {
  if (!iso) return "Aldri";
  return format(new Date(iso), "d. MMM yyyy HH:mm", { locale: nb });
}

export function formatPublishDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  try {
    return format(parseISO(isoDate), "d. MMM yyyy", { locale: nb });
  } catch {
    return isoDate;
  }
}

export function buildSyncHealthDetail(health: OfvSyncHealth): string {
  const parts: string[] = [];

  if (health.ofvStatusAvailable && health.ofvLiveDataVersion != null) {
    parts.push(
      `OFV ${formatPublishDate(health.ofvLivePublishDate)} (v${health.ofvLiveDataVersion})`,
    );
  } else if (health.lastFullPublishDate) {
    parts.push(`synket OFV-data per ${formatPublishDate(health.lastFullPublishDate)}`);
  }

  if (health.lastFullDataVersion != null) {
    parts.push(`DB v${health.lastFullDataVersion}`);
  }

  if (health.populationIncomplete) {
    parts.push(
      `ufullstendig bestand (${health.latestPopulationRows ?? 0} rader)`,
    );
  } else if (health.ofvAhead) {
    parts.push("nyere data hos OFV enn i databasen");
  } else if (
    health.ofvStatusAvailable &&
    health.ofvLiveDataVersion != null &&
    health.lastFullDataVersion === health.ofvLiveDataVersion
  ) {
    parts.push("versjoner matcher");
  }

  parts.push(`sist synket ${formatSyncTimestamp(health.lastAnySyncAt)}`);

  if (health.hoursSinceLastSync != null) {
    parts.push(`${health.hoursSinceLastSync} t siden`);
  }

  if (health.staleRunningLocks > 0) {
    parts.push(`${health.staleRunningLocks} hengende synk`);
  }

  if (health.populationSnapshotCount > 1) {
    parts.push(
      `${health.populationSnapshotCount} bestandsversjoner (beholdes én)`,
    );
  }

  if (health.populationPruneError) {
    parts.push(shortenDetail(health.populationPruneError, 160));
  }

  const lastChecked = formatLastCheckedLine(health);
  if (lastChecked) parts.push(lastChecked);

  return parts.join(" · ");
}

/**
 * Tekst for siste skip, kun når sjekken er nyere enn siste vellykkede synk.
 * «Ingen nye data» krever at skip-versjonen er den som ligger i databasen,
 * og at live OFV ikke har publisert en nyere versjon etterpå.
 * Påvirker ikke status (ok / forsinket / ute av drift).
 */
export function formatLastCheckedLine(health: OfvSyncHealth): string | null {
  if (!health.lastSkipAt) return null;
  if (!isSkipNewerThanSync(health.lastSkipAt, health.lastAnySyncAt)) return null;

  const when = formatSyncTimestamp(health.lastSkipAt);
  const versionsMatch =
    health.lastSkipDataVersion != null &&
    health.lastFullDataVersion != null &&
    health.lastSkipDataVersion === health.lastFullDataVersion;
  const alreadySynced = health.lastSkipReason?.includes("allerede synket") ?? false;

  if (alreadySynced && versionsMatch && !health.ofvAhead) {
    return `sist sjekket ${when} – ingen nye data`;
  }

  if (alreadySynced) return null;

  const reason = health.lastSkipReason?.trim();
  if (reason) return `sist sjekket ${when} – ${shortenDetail(reason, 120)}`;
  return `sist sjekket ${when}`;
}

export function isSkipNewerThanSync(
  lastSkipAt: string | null,
  lastAnySyncAt: string | null,
): boolean {
  if (!lastSkipAt) return false;
  if (!lastAnySyncAt) return true;
  const skipMs = Date.parse(lastSkipAt);
  const syncMs = Date.parse(lastAnySyncAt);
  if (Number.isNaN(skipMs)) return false;
  if (Number.isNaN(syncMs)) return true;
  return skipMs > syncMs;
}

function shortenDetail(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

export async function getOfvSyncHealth(): Promise<OfvSyncHealth | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofv_sync_health")
    .select("*")
    .maybeSingle<OfvSyncHealthRow>();

  if (error || !data) return null;

  const staleRunningLocks = data.stale_running_locks ?? 0;
  const hoursSinceLastSync =
    data.hours_since_last_sync != null
      ? Number(data.hours_since_last_sync)
      : null;

  let ofvLivePublishDate: string | null = null;
  let ofvLiveDataVersion: number | null = null;
  let ofvStatusAvailable = false;

  try {
    const live = await getCachedOfvStatus();
    ofvLivePublishDate = live.publishDate;
    ofvLiveDataVersion = live.dataVersion;
    ofvStatusAvailable = true;
  } catch (err) {
    console.error(
      "Kunne ikke hente OFV /status for helsebadge:",
      err instanceof Error ? err.message : err,
    );
  }

  const ofvAhead =
    ofvStatusAvailable &&
    ofvLiveDataVersion != null &&
    data.last_full_data_version != null &&
    ofvLiveDataVersion > data.last_full_data_version;

  const latestPopulationRows =
    data.latest_population_rows != null
      ? Number(data.latest_population_rows)
      : null;
  const populationIncomplete = Boolean(data.population_incomplete);
  // Mangler kolonnen (migrasjon ikke kjørt): ikke varsle om «0 versjoner».
  const populationSnapshotCount =
    data.population_snapshot_count != null
      ? Number(data.population_snapshot_count)
      : 1;
  const populationPruneError = data.population_prune_error?.trim()
    ? data.population_prune_error.trim()
    : null;
  const lastSkipAt = data.last_skip_at ?? null;
  const lastSkipDataVersion =
    data.last_skip_data_version != null
      ? Number(data.last_skip_data_version)
      : null;
  const lastSkipReason = data.last_skip_reason?.trim()
    ? data.last_skip_reason.trim()
    : null;

  const { status, reason } = resolveSyncHealth(
    hoursSinceLastSync,
    staleRunningLocks,
    ofvAhead,
    ofvStatusAvailable,
    populationIncomplete,
    populationSnapshotCount,
    populationPruneError,
  );

  return {
    lastFullSyncAt: data.last_full_sync_at,
    lastFullDataVersion: data.last_full_data_version,
    lastFullPublishDate: data.last_full_publish_date,
    lastAnySyncAt: data.last_any_sync_at,
    hoursSinceLastSync,
    staleRunningLocks,
    latestPopulationSnapshot: data.latest_population_snapshot,
    latestPopulationRows,
    populationIncomplete,
    populationSnapshotCount,
    populationPruneError,
    lastSkipAt,
    lastSkipDataVersion,
    lastSkipReason,
    ofvLivePublishDate,
    ofvLiveDataVersion,
    ofvStatusAvailable,
    ofvAhead,
    status,
    reason,
  };
}
