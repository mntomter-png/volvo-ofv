import {
  HEAVY_TRUCK_MIN_KG,
  OFV_TRANSACTION_NEW_REGISTRATION,
} from "@/lib/ofv/constants";
import {
  ALL_PABYGG_SEGMENTS,
  CHASSIS_TYPES,
  type ChassisType,
  type PabyggSegment,
} from "@/lib/ofv/segmentation";

export interface RegistrationsFilters {
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
  /** Valgfri slagvolum-bøtte (1-6, se DISP_BUCKET_ORDER). */
  disp: number | null;
  /** Valgfri chassis-type (trekker / jevnlast). */
  chassis: ChassisType | null;
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

  const dispRaw =
    typeof params.disp === "string" ? Number.parseInt(params.disp, 10) : NaN;
  const disp =
    Number.isFinite(dispRaw) && dispRaw >= 1 && dispRaw <= 6 ? dispRaw : null;

  const chassisRaw = typeof params.chassis === "string" ? params.chassis : null;
  const chassis =
    chassisRaw && (CHASSIS_TYPES as readonly string[]).includes(chassisRaw)
      ? (chassisRaw as ChassisType)
      : null;

  return { segment, make, year, page, month, region, hp, fuel, pabygg, disp, chassis };
}

export function yearOptions(count = 5): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, index) => currentYear - index);
}

export { HEAVY_TRUCK_MIN_KG, OFV_TRANSACTION_NEW_REGISTRATION };
