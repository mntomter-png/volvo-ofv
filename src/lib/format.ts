/** Formateringshjelpere (server-frie – trygge å importere i klientkomponenter). */

const MONTH_LABELS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "mai",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "des",
] as const;

export function formatMonthLabel(isoDate: string): string {
  const month = Number.parseInt(isoDate.slice(5, 7), 10) - 1;
  const year = isoDate.slice(0, 4);
  return `${MONTH_LABELS[month] ?? isoDate} ${year}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("nb-NO").format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}
