import { HEAVY_TRUCK_MIN_KG } from "@/lib/ofv/constants";

export interface PopulationFilters {
  segment: string | null;
  make: string | null;
  page: number;
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

  return { segment, make, page };
}

export { HEAVY_TRUCK_MIN_KG };
