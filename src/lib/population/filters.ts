import { HEAVY_TRUCK_MIN_KG } from "@/lib/ofv/constants";
import {
  ALL_PABYGG_SEGMENTS,
  CHASSIS_TYPES,
  isValidBodyworkFilter,
  isValidDispBucketFilter,
  type ChassisType,
  POPULATION_DISTRICTS,
  type PabyggSegment,
} from "@/lib/ofv/segmentation";

/** Aldersfilter på bestand basert på første registreringsdato. */
export type AgeFilter = "under10" | "over10";
export const AGE_FILTER_VALUES: readonly AgeFilter[] = ["under10", "over10"];

export const AGE_FILTER_OPTIONS: { value: AgeFilter; label: string }[] = [
  { value: "under10", label: "Under 10 år" },
  { value: "over10", label: "10 år eller eldre" },
];

export interface PopulationFilters {
  /** @deprecated Usage-filter – beholdes kun for gamle bokmerker; brukes ikke i UI. */
  segment: string | null;
  make: string | null;
  page: number;
  region: number | null;
  /** Volvo-distrikt utledet fra brukerens postnummer. */
  district: string | null;
  hp: number | null;
  fuel: string | null;
  pabygg: PabyggSegment | null;
  /** OFV AdditionalBodyworks-kode (−1 = uten påbygg). */
  bodywork: number | null;
  disp: number | null;
  chassis: ChassisType | null;
  /** Kjøretøyalder: under 10 år eller 10 år+ (fra første registreringsdato). */
  age: AgeFilter | null;
}

export function parsePopulationSearchParams(
  params: Record<string, string | string[] | undefined>,
): PopulationFilters {
  const segment =
    typeof params.segment === "string" && params.segment.length > 0
      ? params.segment
      : null;
  const make =
    typeof params.make === "string" && params.make.length > 0
      ? params.make
      : null;
  const pageRaw =
    typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const regionRaw =
    typeof params.region === "string" ? Number.parseInt(params.region, 10) : NaN;
  const region =
    Number.isFinite(regionRaw) && regionRaw >= 1 && regionRaw <= 5
      ? regionRaw
      : null;

  const districtRaw =
    typeof params.district === "string" && params.district.length > 0
      ? params.district
      : null;
  const district =
    districtRaw && POPULATION_DISTRICTS.has(districtRaw) ? districtRaw : null;

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

  const ageRaw = typeof params.age === "string" ? params.age : null;
  const age =
    ageRaw && (AGE_FILTER_VALUES as readonly string[]).includes(ageRaw)
      ? (ageRaw as AgeFilter)
      : null;

  return {
    segment,
    make,
    page,
    region,
    district,
    hp,
    fuel,
    pabygg,
    bodywork,
    disp,
    chassis,
    age,
  };
}

export { HEAVY_TRUCK_MIN_KG };
