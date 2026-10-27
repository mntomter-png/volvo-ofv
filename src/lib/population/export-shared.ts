import {
  parsePopulationSearchParams,
  populationAgeCutoff,
  type PopulationFilters,
} from "@/lib/population/filters";

export const POPULATION_EXPORT_BUCKET = "population-exports";
export const POPULATION_EXPORT_PAGE_SIZE = 1000;
export const POPULATION_EXPORT_MAX_ROWS = 100_000;
/**
 * Filtrert eksport bygges i forespørselen opp til dette antallet.
 * Målt ca. 158 byte/rad på de 14 kolonnene, så 30 000 rader er ca. 4,8 MB
 * og under grensen på 5 MB. Større utvalg går til bakgrunnsjobb.
 */
export const FILTERED_DIRECT_MAX_ROWS = 30_000;
export const FULL_EXPORT_STALE_MS = 20 * 60 * 1000;
export const FULL_POPULATION_EXPORT_POINTER = "full/latest.json";
/** Forrige snapshot beholdes sammen med det nyeste. */
export const FULL_POPULATION_EXPORT_KEEP = 2;
/** Kort levetid: lenken er en nøkkel til filen. */
export const POPULATION_EXPORT_URL_TTL_SECONDS = 60;
export const POPULATION_EXPORT_FUNCTION = "population-export-background";

export const POPULATION_EXPORT_STATUSES = [
  "queued",
  "running",
  "ready",
  "failed",
] as const;

export type PopulationExportStatusName =
  (typeof POPULATION_EXPORT_STATUSES)[number];

export interface PopulationExportRow {
  registration_number: string;
  make_name: string | null;
  model_name: string | null;
  variant_name: string | null;
  usage_name: string | null;
  maximum_laden_mass_kg: number | null;
  first_registration_date: string | null;
  vehicle_status: string | null;
  primary_owner_name: string | null;
  primary_owner_postal_code: string | null;
  primary_owner_postal_district: string | null;
  primary_user_name: string | null;
  primary_user_postal_code: string | null;
  primary_user_postal_district: string | null;
}

export interface PopulationExportPageArgs {
  p_snapshot_date: string;
  p_after_registration_number: string | null;
  p_limit: number;
  p_segment: string | null;
  p_make: string | null;
  p_region: number | null;
  p_district: string | null;
  p_hp: number | null;
  p_fuel: string | null;
  p_pabygg: string | null;
  p_disp: number | null;
  p_chassis: string | null;
  p_bodywork: number | null;
  p_age: PopulationFilters["age"];
  p_age_cutoff: string;
  p_q: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** `{userId}/{jobId}.xlsx` — bare UUID, så stien ikke kan peke utenfor mappen. */
export function populationExportStoragePath(userId: string, jobId: string): string {
  const user = userId.toLowerCase();
  const job = jobId.toLowerCase();
  if (!isUuid(user) || !isUuid(job)) {
    throw new Error("Ugyldig eksportsti.");
  }
  return `${user}/${job}.xlsx`;
}

/** Lagrer de filtrene siden faktisk bruker. `page` er ikke et datafilter. */
export function populationFiltersToStored(
  filters: PopulationFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.segment) params.segment = filters.segment;
  if (filters.make) params.make = filters.make;
  if (filters.region != null) params.region = String(filters.region);
  if (filters.district) params.district = filters.district;
  if (filters.hp != null) params.hp = String(filters.hp);
  if (filters.fuel) params.fuel = filters.fuel;
  if (filters.pabygg) params.pabygg = filters.pabygg;
  if (filters.bodywork != null) params.bodywork = String(filters.bodywork);
  if (filters.disp != null) params.disp = String(filters.disp);
  if (filters.chassis) params.chassis = filters.chassis;
  if (filters.age) params.age = filters.age;
  if (filters.search) params.q = filters.search;
  return params;
}

export function populationFiltersFromStored(value: unknown): PopulationFilters {
  const params: Record<string, string> = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, raw] of Object.entries(value)) {
      if (typeof raw === "string") params[key] = raw;
    }
  }
  return { ...parsePopulationSearchParams(params), page: 1 };
}

export function populationExportPageArgs(
  filters: PopulationFilters,
  snapshotDate: string,
  afterRegistrationNumber: string | null,
  limit: number,
  now = new Date(),
): PopulationExportPageArgs {
  const pageSize = Math.min(
    POPULATION_EXPORT_PAGE_SIZE,
    Math.max(1, Math.floor(limit)),
  );
  return {
    p_snapshot_date: snapshotDate,
    p_after_registration_number: afterRegistrationNumber,
    p_limit: pageSize,
    p_segment: filters.segment,
    p_make: filters.make,
    p_region: filters.region,
    p_district: filters.district,
    p_hp: filters.hp,
    p_fuel: filters.fuel,
    p_pabygg: filters.pabygg,
    p_disp: filters.disp,
    p_chassis: filters.chassis,
    p_bodywork: filters.bodywork,
    p_age: filters.age,
    p_age_cutoff: populationAgeCutoff(now),
    p_q: filters.search,
  };
}

export function isPopulationExportStatus(
  value: unknown,
): value is PopulationExportStatusName {
  return (
    typeof value === "string" &&
    (POPULATION_EXPORT_STATUSES as readonly string[]).includes(value)
  );
}

const SNAPSHOT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ingen sidefiltre. Totalvektgrensen på 16 tonn ligger i spørringen uansett. */
export function isUnfilteredPopulationExport(filters: PopulationFilters): boolean {
  return Object.keys(populationFiltersToStored(filters)).length === 0;
}

export function filteredExportUsesDirectResponse(rowCount: number | null): boolean {
  return rowCount !== null && rowCount <= FILTERED_DIRECT_MAX_ROWS;
}

export function fullPopulationExportPath(snapshotDate: string): string {
  if (!SNAPSHOT_DATE_RE.test(snapshotDate)) {
    throw new Error("Ugyldig snapshot.");
  }
  return `full/${snapshotDate}.xlsx`;
}

export function isFullPopulationExportPath(path: string): boolean {
  return /^full\/\d{4}-\d{2}-\d{2}\.xlsx$/.test(path);
}

/** Stier service_role kan signere. Alt annet avvises. */
export function isSignablePopulationExportPath(path: string): boolean {
  if (isFullPopulationExportPath(path)) return true;
  const match = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.xlsx$/i.exec(path);
  return Boolean(match && isUuid(match[1]!) && isUuid(match[2]!));
}

export interface FullPopulationExportRow {
  status: string;
  updatedAt: string;
  storagePath: string | null;
}

/**
 * Klar fil signeres med en gang. En fersk bygging ventes på.
 * Mangler, feil eller en bygging som har stått fast starter på nytt.
 */
export function fullExportAction(
  row: FullPopulationExportRow | null,
  now: number,
  staleMs = FULL_EXPORT_STALE_MS,
): "sign" | "wait" | "start" {
  if (!row) return "start";
  if (row.status === "ready" && row.storagePath) return "sign";
  const updated = Date.parse(row.updatedAt);
  if (
    row.status === "building" &&
    Number.isFinite(updated) &&
    updated > now - staleMs
  ) {
    return "wait";
  }
  return "start";
}

/** Filnavn i mappen `full/`, ikke hele stien. Beholder de nyeste xlsx-ene. */
export function fullExportObjectsToDelete(
  names: readonly string[],
  keep = FULL_POPULATION_EXPORT_KEEP,
): string[] {
  const files = names
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.xlsx$/.test(name))
    .sort()
    .reverse();
  return files.slice(keep).map((name) => `full/${name}`);
}
