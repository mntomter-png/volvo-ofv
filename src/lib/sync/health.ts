import { format } from "date-fns";
import { nb } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";

export type SyncHealthStatus = "ok" | "warning" | "critical";

export interface OfvSyncHealth {
  lastFullSyncAt: string | null;
  lastFullDataVersion: number | null;
  lastFullPublishDate: string | null;
  lastAnySyncAt: string | null;
  hoursSinceLastSync: number | null;
  staleRunningLocks: number;
  status: SyncHealthStatus;
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

export function resolveSyncHealthStatus(
  hoursSinceLastSync: number | null,
  staleRunningLocks: number,
): SyncHealthStatus {
  if (staleRunningLocks > 0) return "warning";
  if (hoursSinceLastSync == null) return "critical";
  if (hoursSinceLastSync > WARNING_MAX_HOURS) return "critical";
  if (hoursSinceLastSync > OK_MAX_HOURS) return "warning";
  return "ok";
}

export function syncHealthStatusLabel(status: SyncHealthStatus): string {
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

export function buildSyncHealthDetail(health: OfvSyncHealth): string {
  const parts: string[] = [];

  if (health.lastFullPublishDate) {
    parts.push(`OFV-data per ${health.lastFullPublishDate}`);
  }

  if (health.lastFullDataVersion != null) {
    parts.push(`versjon ${health.lastFullDataVersion}`);
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

  return {
    lastFullSyncAt: data.last_full_sync_at,
    lastFullDataVersion: data.last_full_data_version,
    lastFullPublishDate: data.last_full_publish_date,
    lastAnySyncAt: data.last_any_sync_at,
    hoursSinceLastSync,
    staleRunningLocks,
    status: resolveSyncHealthStatus(hoursSinceLastSync, staleRunningLocks),
  };
}
