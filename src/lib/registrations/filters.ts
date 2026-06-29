import {
  HEAVY_TRUCK_MIN_KG,
  OFV_TRANSACTION_NEW_REGISTRATION,
} from "@/lib/ofv/constants";

export interface RegistrationsFilters {
  segment: string | null;
  make: string | null;
  year: number;
  page: number;
  /** Valgfri nedboring til én måned (1-12) for merkefordeling. */
  month: number | null;
  /** Valgfri salgsregion (1-5, Volvo-forhandlernett). */
  region: number | null;
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

  return { segment, make, year, page, month, region };
}

export function yearOptions(count = 5): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, index) => currentYear - index);
}

export { HEAVY_TRUCK_MIN_KG, OFV_TRANSACTION_NEW_REGISTRATION };
