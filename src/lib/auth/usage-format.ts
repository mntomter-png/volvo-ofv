/** Kalenderdager uten aktivitet før bruker markeres som inaktiv. */
export const INACTIVE_AFTER_DAYS = 14;

const ACTIVITY_TZ = "Europe/Oslo";

/** Antall kalenderdager mellom to tidspunkter i norsk tid (0 = samme dag). */
export function calendarDaysBetween(
  fromIso: string,
  to: Date = new Date(),
): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ACTIVITY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const fromDay = formatter.format(new Date(fromIso)); // YYYY-MM-DD
  const toDay = formatter.format(to);
  const fromUtc = Date.parse(`${fromDay}T00:00:00Z`);
  const toUtc = Date.parse(`${toDay}T00:00:00Z`);
  return Math.max(0, Math.round((toUtc - fromUtc) / (24 * 60 * 60 * 1000)));
}

export function formatDaysSinceLabel(daysSinceSeen: number): string {
  if (daysSinceSeen === 0) return "I dag";
  if (daysSinceSeen === 1) return "I går";
  return `${daysSinceSeen} dager siden`;
}
