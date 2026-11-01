import type { RegistrationsFilters } from "@/lib/registrations/filters";

/** Spørringsparametre til Excel-eksporten. Måned, fleet og chassis er med. */
export function registrationsExportParams(
  filters: RegistrationsFilters,
): Record<string, string | number | null> {
  return {
    make: filters.make,
    year: filters.year,
    month: filters.month,
    region: filters.region,
    hp: filters.hp,
    fuel: filters.fuel,
    pabygg: filters.pabygg,
    bodywork: filters.bodywork,
    disp: filters.disp,
    chassis: filters.chassis,
    from: filters.from,
    to: filters.to,
    fleet: filters.fleet === "all" ? null : filters.fleet,
    q: filters.search,
  };
}
