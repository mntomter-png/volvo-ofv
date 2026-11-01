import type { RegistrationsFilters } from "@/lib/registrations/filters";

export interface PotentialTotals {
  accounts: number;
  avgScore: number;
  untapped: number;
  reactivation: number;
  competitor: number;
}

const EMPTY_TOTALS: PotentialTotals = {
  accounts: 0,
  avgScore: 0,
  untapped: 0,
  reactivation: 0,
  competitor: 0,
};

/** Totaltall fra vinduskolonnene på reg_potential_list. Tom liste = 0, ikke topp-N. */
export function readPotentialTotals(
  rows:
    | ReadonlyArray<{
        total_accounts: number;
        avg_score: number;
        untapped_count: number;
        reactivation_count: number;
        competitor_count: number;
      }>
    | null
    | undefined,
): PotentialTotals {
  const first = rows?.[0];
  if (!first) return EMPTY_TOTALS;
  return {
    accounts: first.total_accounts,
    avgScore: first.avg_score,
    untapped: first.untapped_count,
    reactivation: first.reactivation_count,
    competitor: first.competitor_count,
  };
}

/** Spørringsparametre for Potensial-Excel. Tar med motorstørrelse og chassis. */
export function buildPotentialExportParams(
  filters: RegistrationsFilters,
  options: { excludeFinance: boolean; district: string | null },
): URLSearchParams {
  const params = new URLSearchParams({
    year: String(filters.year),
    excludeFinance: options.excludeFinance ? "1" : "0",
  });
  if (filters.region != null) params.set("region", String(filters.region));
  if (options.district) params.set("district", options.district);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.pabygg) params.set("pabygg", filters.pabygg);
  if (filters.bodywork != null) {
    params.set("bodywork", String(filters.bodywork));
  }
  if (filters.hp != null) params.set("hp", String(filters.hp));
  if (filters.fuel) params.set("fuel", filters.fuel);
  if (filters.segment) params.set("segment", filters.segment);
  if (filters.disp != null) params.set("disp", String(filters.disp));
  if (filters.chassis) params.set("chassis", filters.chassis);
  if (filters.month != null) params.set("month", String(filters.month));
  if (filters.make) params.set("make", filters.make);
  if (filters.search) params.set("q", filters.search);
  return params;
}
