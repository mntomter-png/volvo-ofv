import {
  HEAVY_TRUCK_MIN_KG,
  OFV_TRANSACTION_NEW_REGISTRATION,
} from "@/lib/ofv/constants";
import type { FleetFilter } from "@/lib/fleet";
import {
  ALL_PABYGG_SEGMENTS,
  CHASSIS_TYPES,
  isValidBodyworkFilter,
  isValidDispBucketFilter,
  type ChassisType,
  type PabyggSegment,
} from "@/lib/ofv/segmentation";

export interface RegistrationsFilters {
  /** @deprecated Usage-filter – beholdes kun for gamle bokmerker; brukes ikke i UI. */
  segment: string | null;
  make: string | null;
  year: number;
  page: number;
  /** Valgfri nedboring til én måned (1-12) for merkefordeling. */
  month: number | null;
  /** Valgfri salgsregion (1-5, Volvo-forhandlernett). */
  region: number | null;
  /** Valgfri HK-bøtte (1-5, se HP_BUCKET_ORDER). */
  hp: number | null;
  /** Valgfritt drivstoff (fuel_name, f.eks. "Diesel" / "Elektrisitet" / "Gass"). */
  fuel: string | null;
  /** Valgfritt påbygg-segment (Construction / Distribution / Long Haul / Annet). */
  pabygg: PabyggSegment | null;
  /** OFV AdditionalBodyworks-kode (−1 = uten påbygg). */
  bodywork: number | null;
  /** Valgfri slagvolum-bøtte (0 = ukjent, 1–6, se DISP_BUCKET_ORDER). */
  disp: number | null;
  /** Valgfri chassis-type (trekker / jevnlast). */
  chassis: ChassisType | null;
  /** Valgfri startdato (YYYY-MM-DD) – overstyrer år når satt. */
  from: string | null;
  /** Valgfri sluttdato (YYYY-MM-DD, inklusiv) – overstyrer år når satt. */
  to: string | null;
  /** Fleet Sales-filter for region-fanen (alle / kun region / kun fleet). */
  fleet: FleetFilter;
}

/** Validerer en ISO-dato på formatet YYYY-MM-DD. */
export function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : value;
}

export function parseRegistrationsSearchParams(
  params: Record<string, string | string[] | undefined>,
): RegistrationsFilters {
  const currentYear = new Date().getFullYear();
  const segment =
    typeof params.segment === "string" && params.segment.length > 0
      ? params.segment
      : null;
  const make =
    typeof params.make === "string" && params.make.length > 0
      ? params.make
      : null;
  const yearRaw =
    typeof params.year === "string" ? Number.parseInt(params.year, 10) : NaN;
  const year =
    Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= currentYear + 1
      ? yearRaw
      : currentYear;
  const pageRaw =
    typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const monthRaw =
    typeof params.month === "string" ? Number.parseInt(params.month, 10) : NaN;
  const month =
    Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : null;

  const regionRaw =
    typeof params.region === "string" ? Number.parseInt(params.region, 10) : NaN;
  const region =
    Number.isFinite(regionRaw) && regionRaw >= 1 && regionRaw <= 5
      ? regionRaw
      : null;

  const hpRaw =
    typeof params.hp === "string" ? Number.parseInt(params.hp, 10) : NaN;
  const hp =
    Number.isFinite(hpRaw) && hpRaw >= 1 && hpRaw <= 5 ? hpRaw : null;

  const fuel =
    typeof params.fuel === "string" && params.fuel.length > 0
      ? params.fuel
      : null;

  const pabyggRaw = typeof params.pabygg === "string" ? params.pabygg : null;
  const pabygg =
    pabyggRaw &&
    (ALL_PABYGG_SEGMENTS as readonly string[]).includes(pabyggRaw)
      ? (pabyggRaw as PabyggSegment)
      : null;

  const bodyworkRaw =
    typeof params.bodywork === "string"
      ? Number.parseInt(params.bodywork, 10)
      : NaN;
  const bodywork =
    Number.isFinite(bodyworkRaw) && isValidBodyworkFilter(bodyworkRaw)
      ? bodyworkRaw
      : null;

  const dispRaw =
    typeof params.disp === "string" ? Number.parseInt(params.disp, 10) : NaN;
  const disp =
    Number.isFinite(dispRaw) && isValidDispBucketFilter(dispRaw) ? dispRaw : null;

  const chassisRaw = typeof params.chassis === "string" ? params.chassis : null;
  const chassis =
    chassisRaw && (CHASSIS_TYPES as readonly string[]).includes(chassisRaw)
      ? (chassisRaw as ChassisType)
      : null;

  let from = parseIsoDate(params.from);
  let to = parseIsoDate(params.to);
  // Bytt om hvis intervallet er angitt baklengs.
  if (from && to && from > to) {
    [from, to] = [to, from];
  }

  const fleetRaw = typeof params.fleet === "string" ? params.fleet : "all";
  const fleet: FleetFilter =
    fleetRaw === "region" || fleetRaw === "fleet" ? fleetRaw : "all";

  return {
    segment,
    make,
    year,
    page,
    month,
    region,
    hp,
    fuel,
    pabygg,
    bodywork,
    disp,
    chassis,
    from,
    to,
    fleet,
  };
}

/** Tilgjengelige år i årsfilteret (2020 → inneværende år). */
export function yearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const startYear = 2020;
  const count = currentYear - startYear + 1;
  return Array.from({ length: count }, (_, index) => currentYear - index);
}

export { HEAVY_TRUCK_MIN_KG, OFV_TRANSACTION_NEW_REGISTRATION };
