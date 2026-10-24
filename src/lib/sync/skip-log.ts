/**
 * Bevisst avbrutt OFV-synk (ingen nye data, eller annen skip).
 *
 * Raden skrives med status `skipped`, aldri `completed`. Helse-viewet og
 * watchdog leser kun `completed` når de vurderer hvor fersk synken er, så
 * en skip nullstiller ikke «sist synket», forsinket/ute av drift eller
 * 20-timersgrensen som får watchdog til å prøve igjen.
 *
 * Samme dataversjon og årsak gjenbruker én rad (completed_at oppdateres).
 * Watchdog kjører hver time og skal ikke fylle sync_logs.
 */

export const SYNC_SKIP_LOG_KIND = "skip";

export type SyncSkipReasonCode = "already_synced";

export type SyncSkipTarget = "full" | "registrations" | "population";

export interface SkipLogCandidate {
  id: string;
  ofv_data_version: number | null;
  metadata: unknown;
}

interface SkipMetadata {
  kind?: string;
  reason?: string;
  compared_version?: number;
}

export function syncSkipMessage(
  code: SyncSkipReasonCode,
  dataVersion: number,
): string {
  switch (code) {
    case "already_synced":
      return `dataVersion ${dataVersion} er allerede synket`;
  }
}

export function syncSkipMetadata(
  code: SyncSkipReasonCode,
  dataVersion: number,
): { kind: typeof SYNC_SKIP_LOG_KIND; reason: SyncSkipReasonCode; compared_version: number } {
  return {
    kind: SYNC_SKIP_LOG_KIND,
    reason: code,
    compared_version: dataVersion,
  };
}

export function readSkipMetadata(metadata: unknown): SkipMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const compared = record.compared_version;
  return {
    kind: typeof record.kind === "string" ? record.kind : undefined,
    reason: typeof record.reason === "string" ? record.reason : undefined,
    compared_version: typeof compared === "number" ? compared : undefined,
  };
}

/** True når raden er samme versjon og samme skip-årsak, så den kan oppdateres. */
export function isReusableSkipLog(
  row: SkipLogCandidate,
  code: SyncSkipReasonCode,
  dataVersion: number,
): boolean {
  if (row.ofv_data_version !== dataVersion) return false;
  const meta = readSkipMetadata(row.metadata);
  if (!meta) return false;
  if (meta.kind !== SYNC_SKIP_LOG_KIND) return false;
  if (meta.reason !== code) return false;
  if (meta.compared_version != null && meta.compared_version !== dataVersion) {
    return false;
  }
  return true;
}

/** Én rad per versjon og årsak. Ny rad bare når ingen kan gjenbrukes. */
export function planSkipWrite(
  existing: SkipLogCandidate | null,
  code: SyncSkipReasonCode,
  dataVersion: number,
): "insert" | "update" {
  if (existing && isReusableSkipLog(existing, code, dataVersion)) return "update";
  return "insert";
}

export function buildSkipLogInsert(input: {
  syncType: SyncSkipTarget;
  dataVersion: number;
  publishDate: string;
  code: SyncSkipReasonCode;
  checkedAt: string;
}) {
  return {
    sync_type: input.syncType,
    status: "skipped" as const,
    completed_at: input.checkedAt,
    ofv_data_version: input.dataVersion,
    ofv_publish_date: input.publishDate,
    records_fetched: 0,
    records_upserted: 0,
    error_message: syncSkipMessage(input.code, input.dataVersion),
    metadata: syncSkipMetadata(input.code, input.dataVersion),
  };
}

/**
 * Oppdaterer tidspunkt og tekst på en eksisterende skip-rad.
 * Setter ikke status, så raden kan ikke bli `completed` ved en ny sjekk.
 * Rører ikke started_at (første gang vi så denne versjonen).
 */
export function buildSkipLogRefresh(input: {
  dataVersion: number;
  publishDate: string;
  code: SyncSkipReasonCode;
  checkedAt: string;
}) {
  return {
    completed_at: input.checkedAt,
    ofv_publish_date: input.publishDate,
    records_fetched: 0,
    records_upserted: 0,
    error_message: syncSkipMessage(input.code, input.dataVersion),
    metadata: syncSkipMetadata(input.code, input.dataVersion),
  };
}

export function isUniqueViolation(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "23505") return true;
  const message = error.message ?? "";
  return message.includes("sync_logs_skip_version_reason_uidx");
}
