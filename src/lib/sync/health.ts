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
  | "never_synced";

export interface OfvSyncHealth {
  lastFullSyncAt: string | null;
  lastFullDataVersion: number | null;
  lastFullPublishDate: string | null;
  lastAnySyncAt: string | null;
  hoursSinceLastSync: number | null;
  staleRunningLocks: number;
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
): { status: SyncHealthStatus; reason: SyncHealthReason } {
  if (staleRunningLocks > 0) {
    return { status: "warning", reason: "stale_lock" };
  }
  if (hoursSinceLastSync == null) {
    return { status: "critical", reason: "never_synced" };
  }
  if (hoursSinceLastSync > WARNING_MAX_HOURS) {
    return { status: "critical", reason: "sync_stale" };
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

export function syncHealthStatusLabel(
  status: SyncHealthStatus,
  reason?: SyncHealthReason,
): string {
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

  if (health.ofvAhead) {
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

  return parts.join(" · ");
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

  const { status, reason } = resolveSyncHealth(
    hoursSinceLastSync,
    staleRunningLocks,
    ofvAhead,
    ofvStatusAvailable,
  );

  return {
    lastFullSyncAt: data.last_full_sync_at,
    lastFullDataVersion: data.last_full_data_version,
    lastFullPublishDate: data.last_full_publish_date,
    lastAnySyncAt: data.last_any_sync_at,
    hoursSinceLastSync,
    staleRunningLocks,
    ofvLivePublishDate,
    ofvLiveDataVersion,
    ofvStatusAvailable,
    ofvAhead,
    status,
    reason,
  };
}
