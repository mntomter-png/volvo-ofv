import type { RegistrationsFilters } from "@/lib/registrations/filters";

export const DATA_START_YEAR = 2020;

export interface KpiYoYComparison {
  periodLabel: string;
  total: number;
  volvoCount: number;
  volvoShare: number;
}

/** Flytt en ISO-dato (YYYY-MM-DD) med et antall år. */
export function shiftIsoDateByYears(isoDate: string, years: number): string {
  const parts = isoDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Eksklusiv øvre grense dagen etter isoDate. */
export function nextDayExclusive(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.toISOString().slice(0, 10)}T00:00:00`;
}

/** YTD-registreringer: 1. jan i år til i dag, og tilsvarende periode i fjor. */
export function ytdRegistrationRanges(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;

  return {
    current: {
      from: `${year}-01-01T00:00:00`,
      toExclusive: nextDayExclusive(today),
    },
    previous:
      year - 1 >= DATA_START_YEAR
        ? {
            from: `${year - 1}-01-01T00:00:00`,
            toExclusive: nextDayExclusive(`${year - 1}-${month}-${day}`),
            periodLabel: `YTD ${year - 1}`,
          }
        : null,
  };
}

/** Samme filtre som nå, men for sammenligningsperioden ett år tilbake. */
export function previousPeriodFilters(
  filters: RegistrationsFilters,
): RegistrationsFilters | null {
  if (filters.from || filters.to) {
    const prevFrom = filters.from
      ? shiftIsoDateByYears(filters.from, -1)
      : null;
    const prevTo = filters.to ? shiftIsoDateByYears(filters.to, -1) : null;
    const comparisonYear = prevFrom
      ? Number.parseInt(prevFrom.slice(0, 4), 10)
      : prevTo
        ? Number.parseInt(prevTo.slice(0, 4), 10)
        : filters.year - 1;

    if (comparisonYear < DATA_START_YEAR) return null;

    return {
      ...filters,
      year: comparisonYear,
      from: prevFrom,
      to: prevTo,
    };
  }

  const comparisonYear = filters.year - 1;
  if (comparisonYear < DATA_START_YEAR) return null;

  return {
    ...filters,
    year: comparisonYear,
    from: null,
    to: null,
  };
}

export function comparisonPeriodLabel(
  filters: RegistrationsFilters,
  comparisonYear: number,
): string {
  if (filters.from || filters.to) {
    return `samme periode i ${comparisonYear}`;
  }
  return String(comparisonYear);
}
