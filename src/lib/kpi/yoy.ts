import type { RegistrationsFilters } from "@/lib/registrations/filters";

export const DATA_START_YEAR = 2020;

export interface KpiYoYComparison {
  periodLabel: string;
  total: number;
  volvoCount: number;
  volvoShare: number;
  electricCount?: number;
  electricShare?: number;
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

export function todayIso(referenceDate = new Date()): string {
  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const d = String(referenceDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Aktiv periode for registreringer:
 * - Start: fra-filter, ellers 1. jan i valgt år
 * - Slutt: til-filter, ellers dagens dato (inneværende år) eller 31. des (tidligere år)
 */
export function resolveRegistrationPeriod(
  filters: Pick<RegistrationsFilters, "year" | "from" | "to">,
  referenceDate = new Date(),
): { from: string; to: string } {
  const today = todayIso(referenceDate);
  const from = filters.from ?? `${filters.year}-01-01`;

  let to: string;
  if (filters.to) {
    to = filters.to;
  } else if (filters.year === referenceDate.getFullYear()) {
    to = today;
  } else {
    to = `${filters.year}-12-31`;
  }

  return { from, to };
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

/** YTD-registreringer for dashbord (inneværende år til i dag). */
export function ytdRegistrationRanges(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const period = resolveRegistrationPeriod(
    { year, from: null, to: null },
    referenceDate,
  );
  const prevFrom = shiftIsoDateByYears(period.from, -1);
  const prevTo = shiftIsoDateByYears(period.to, -1);

  return {
    current: {
      from: `${period.from}T00:00:00`,
      toExclusive: nextDayExclusive(period.to),
    },
    previous:
      year - 1 >= DATA_START_YEAR
        ? {
            from: `${prevFrom}T00:00:00`,
            toExclusive: nextDayExclusive(prevTo),
            periodLabel: `YTD ${year - 1}`,
          }
        : null,
  };
}

/** Filtre for sammenligningsperioden ett år tilbake (samme datointervall). */
export function previousPeriodFilters(
  filters: RegistrationsFilters,
  referenceDate = new Date(),
): RegistrationsFilters | null {
  const { from, to } = resolveRegistrationPeriod(filters, referenceDate);
  const prevFrom = shiftIsoDateByYears(from, -1);
  const prevTo = shiftIsoDateByYears(to, -1);
  const comparisonYear = Number.parseInt(prevFrom.slice(0, 4), 10);

  if (comparisonYear < DATA_START_YEAR) return null;

  return {
    ...filters,
    year: comparisonYear,
    from: prevFrom,
    to: prevTo,
  };
}

export function comparisonPeriodLabel(
  filters: RegistrationsFilters,
  referenceDate = new Date(),
): string {
  const { from, to } = resolveRegistrationPeriod(filters, referenceDate);
  const prevFrom = shiftIsoDateByYears(from, -1);
  const prevTo = shiftIsoDateByYears(to, -1);
  const today = todayIso(referenceDate);

  if (from === `${filters.year}-01-01` && to === `${filters.year}-12-31`) {
    return String(filters.year - 1);
  }

  if (
    from === `${filters.year}-01-01` &&
    to === today &&
    filters.year === referenceDate.getFullYear() &&
    !filters.from &&
    !filters.to
  ) {
    return `YTD ${filters.year - 1}`;
  }

  if (from === prevFrom && to === prevTo) {
    return formatShortDate(prevTo);
  }

  return `${formatShortDate(prevFrom)}–${formatShortDate(prevTo)}`;
}

export function registrationPeriodDescription(
  filters: Pick<RegistrationsFilters, "year" | "from" | "to">,
  referenceDate = new Date(),
): string {
  const { from, to } = resolveRegistrationPeriod(filters, referenceDate);
  const today = todayIso(referenceDate);

  if (
    from === `${filters.year}-01-01` &&
    to === today &&
    filters.year === referenceDate.getFullYear() &&
    !filters.from &&
    !filters.to
  ) {
    return `Tunge lastebiler ≥ 16t YTD ${filters.year}`;
  }

  if (from === `${filters.year}-01-01` && to === `${filters.year}-12-31`) {
    return `Tunge lastebiler ≥ 16t i ${filters.year}`;
  }

  return `Tunge lastebiler ≥ 16t ${formatShortDate(from)}–${formatShortDate(to)}`;
}
