import type { RegistrationsFilters } from "@/lib/registrations/filters";

export const DATA_START_YEAR = 2020;

const OSLO = "Europe/Oslo";

export interface KpiYoYComparison {
  periodLabel: string;
  total: number;
  volvoCount: number;
  volvoShare: number;
  electricCount?: number;
  electricShare?: number;
}

export interface RegistrationWindow {
  from: string | null;
  to: string | null;
}

type WindowFilters = Pick<RegistrationsFilters, "year" | "from" | "to"> & {
  month?: number | null;
  dataThrough?: string | null;
};

/** Flytt en ISO-dato (YYYY-MM-DD) med et antall år. */
export function shiftIsoDateByYears(isoDate: string, years: number): string {
  const parts = isoDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Kalenderdato i Europe/Oslo for et tidsstempel. */
export function osloCalendarDate(instant: Date): string {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: OSLO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return formatted;
}

export function osloYear(instant: Date): number {
  return Number.parseInt(osloCalendarDate(instant).slice(0, 4), 10);
}

/** Minutter øst for UTC for et absolutt tidspunkt i Oslo (CET +60 / CEST +120). */
export function osloOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OSLO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  let hour = read("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    hour,
    read("minute"),
    read("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/** Midnatt i Oslo for en kalenderdato, med eksplisitt offset. */
export function osloDayStart(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcMidnight = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  const offset = osloOffsetMinutes(utcMidnight);
  const osloMidnight = new Date(utcMidnight.getTime() - offset * 60_000);
  const settled = osloOffsetMinutes(osloMidnight);
  return `${isoDate}T00:00:00${formatOffset(settled)}`;
}

function nextCalendarDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month: number): string {
  const nextMonth =
    month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
  const [y, m, d] = nextMonth.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Eksklusiv øvre grense: midnatt neste kalenderdag i Oslo. */
export function nextDayExclusive(isoDate: string): string {
  return osloDayStart(nextCalendarDay(isoDate));
}

/** Samme grense som nextDayExclusive. Beholdes for radfiltre. */
export function osloDayEndExclusive(isoDate: string): string {
  return nextDayExclusive(isoDate);
}

export function todayIso(referenceDate = new Date()): string {
  return osloCalendarDate(referenceDate);
}

function capToData(to: string | null, dataThrough: string | null): string | null {
  if (!to || !dataThrough) return to;
  return to > dataThrough ? dataThrough : to;
}

/**
 * Datoer som sendes til SQL og radfiltre.
 * Eksplisitt fra/til beholdes (åpen start når bare «til» er satt).
 * Uten datoer: 1. jan til 31. des, eller til siste data/i dag for inneværende år.
 * Måned skjærer vinduet. Slutt etter siste registreringsdato kappes,
 * så YoY sammenligner samme spenn.
 */
export function registrationQueryWindow(
  filters: WindowFilters,
  referenceDate = new Date(),
): RegistrationWindow {
  const today = todayIso(referenceDate);
  const through = filters.dataThrough ?? null;
  const currentYear = filters.year === osloYear(referenceDate);

  let from: string | null;
  let to: string | null;

  if (filters.from || filters.to) {
    from = filters.from;
    to = filters.to;
    if (!filters.to && through) to = through;
    to = capToData(to, through);
  } else {
    from = `${filters.year}-01-01`;
    to = currentYear ? (through && through < today ? through : today) : `${filters.year}-12-31`;
    to = capToData(to, through);
  }

  if (filters.month != null) {
    const monthStart = `${filters.year}-${pad2(filters.month)}-01`;
    const monthEnd = lastDayOfMonth(filters.year, filters.month);
    from = !from || from < monthStart ? monthStart : from;
    to = !to || to > monthEnd ? monthEnd : to;
  }

  return { from, to };
}

/**
 * Aktiv periode for registreringer. Åpen start fylles med 1. januar
 * slik at etiketter og YoY har to datoer. Selve spørringen bruker
 * `registrationQueryWindow`, som kan la starten være åpen.
 */
export function resolveRegistrationPeriod(
  filters: WindowFilters,
  referenceDate = new Date(),
): { from: string; to: string } {
  const window = registrationQueryWindow(filters, referenceDate);
  const today = todayIso(referenceDate);
  return {
    from: window.from ?? `${filters.year}-01-01`,
    to: window.to ?? (filters.year === osloYear(referenceDate) ? today : `${filters.year}-12-31`),
  };
}

function defaultAsOf(filters: WindowFilters, referenceDate: Date): string {
  const today = todayIso(referenceDate);
  const through = filters.dataThrough;
  if (through && through < today) return through;
  return today;
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

/** YTD-registreringer for dashbord (inneværende år til i dag, Oslo). */
export function ytdRegistrationRanges(referenceDate = new Date()) {
  const year = osloYear(referenceDate);
  const period = resolveRegistrationPeriod(
    { year, from: null, to: null },
    referenceDate,
  );
  const prevFrom = shiftIsoDateByYears(period.from, -1);
  const prevTo = shiftIsoDateByYears(period.to, -1);

  return {
    current: {
      from: osloDayStart(period.from),
      toExclusive: nextDayExclusive(period.to),
    },
    previous:
      year - 1 >= DATA_START_YEAR
        ? {
            from: osloDayStart(prevFrom),
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
  const { from, to } = registrationQueryWindow(filters, referenceDate);
  if (!from || !to) return null;

  const prevFrom = shiftIsoDateByYears(from, -1);
  const prevTo = shiftIsoDateByYears(to, -1);
  const comparisonYear = Number.parseInt(prevFrom.slice(0, 4), 10);

  if (comparisonYear < DATA_START_YEAR) return null;

  return {
    ...filters,
    year: comparisonYear,
    from: prevFrom,
    to: prevTo,
    // Vinduet er allerede skåret til måned og datadato.
    month: null,
  };
}

export function comparisonPeriodLabel(
  filters: RegistrationsFilters,
  referenceDate = new Date(),
): string {
  const { from, to } = resolveRegistrationPeriod(filters, referenceDate);
  const prevFrom = shiftIsoDateByYears(from, -1);
  const prevTo = shiftIsoDateByYears(to, -1);
  const asOf = defaultAsOf(filters, referenceDate);

  if (from === `${filters.year}-01-01` && to === `${filters.year}-12-31`) {
    return String(filters.year - 1);
  }

  if (
    from === `${filters.year}-01-01` &&
    to === asOf &&
    filters.year === osloYear(referenceDate) &&
    !filters.from &&
    !filters.to &&
    filters.month == null
  ) {
    return `YTD ${filters.year - 1}`;
  }

  if (from === prevFrom && to === prevTo) {
    return formatShortDate(prevTo);
  }

  return `${formatShortDate(prevFrom)}–${formatShortDate(prevTo)}`;
}

/** Kort periodeetikett for tabellbeskrivelser (f.eks. «hittil i år», «i 2024»). */
export function registrationPeriodShortLabel(
  filters: WindowFilters,
  referenceDate = new Date(),
): string {
  const { from, to } = resolveRegistrationPeriod(filters, referenceDate);
  const asOf = defaultAsOf(filters, referenceDate);

  if (
    from === `${filters.year}-01-01` &&
    to === asOf &&
    filters.year === osloYear(referenceDate) &&
    !filters.from &&
    !filters.to &&
    filters.month == null
  ) {
    return "hittil i år";
  }

  if (from === `${filters.year}-01-01` && to === `${filters.year}-12-31`) {
    return `i ${filters.year}`;
  }

  return `${formatShortDate(from)}–${formatShortDate(to)}`;
}

export function registrationPeriodDescription(
  filters: WindowFilters,
  referenceDate = new Date(),
): string {
  const { from, to } = resolveRegistrationPeriod(filters, referenceDate);
  const asOf = defaultAsOf(filters, referenceDate);

  if (
    from === `${filters.year}-01-01` &&
    to === asOf &&
    filters.year === osloYear(referenceDate) &&
    !filters.from &&
    !filters.to &&
    filters.month == null
  ) {
    return `Tunge lastebiler ≥ 16 t YTD ${filters.year}`;
  }

  if (from === `${filters.year}-01-01` && to === `${filters.year}-12-31`) {
    return `Tunge lastebiler ≥ 16 t i ${filters.year}`;
  }

  return `Tunge lastebiler ≥ 16 t ${formatShortDate(from)}–${formatShortDate(to)}`;
}
