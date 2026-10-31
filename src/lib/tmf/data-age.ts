import { findSsbIndicatorSource } from "@/lib/ssb/indicators";
import {
  COMMERCIAL_KIND_LABELS,
  type TmfCommercialIndicator,
  type TmfCommercialKind,
} from "@/lib/tmf/commercial";

/** Manuelle ordre- og tilbudstall skal ikke ligge upåaktet lenger enn dette. */
export const COMMERCIAL_STALE_DAYS = 45;
/** Nyregistreringer og bestand synkes daglig. Mer enn noen dager er et varsel. */
export const OFV_DATA_STALE_DAYS = 3;
/**
 * Avstand i måneder mot den nyeste SSB-serien, uansett frekvens, som regnes
 * som klart utdatert. Et vanlig års-tall som slutter året før en månedsserie
 * i inneværende år (typisk 8–14 måneder) går under denne grensen.
 */
export const SSB_CLEARLY_STALE_MONTHS = 15;

const MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

const MS_PER_DAY = 86_400_000;

export interface TmfOfvFreshness {
  /** Datoen dataene gjelder, `YYYY-MM-DD` eller tidsstempel. */
  publishDate: string | null;
  syncedAt: string | null;
}

export interface TmfSsbSeriesFreshness {
  indicatorKey: string;
  label: string;
  latestPeriod: string;
}

export interface TmfDataAgeInput {
  now: Date;
  commercial: TmfCommercialIndicator[];
  ssbIndicators: TmfSsbSeriesFreshness[];
  registrations: TmfOfvFreshness | null;
  population: TmfOfvFreshness | null;
}

export interface TmfDataAgeItem {
  id: string;
  label: string;
  /** Kort alder, for eksempel «3 dager siden» eller «2024». */
  ageLabel: string;
  status: "ok" | "warn";
  /** Forklaring. Alltid satt når status er warn. */
  detail: string | null;
}

export interface TmfDataAgeReport {
  items: TmfDataAgeItem[];
  warnings: TmfDataAgeItem[];
}

interface PeriodRank {
  type: "year" | "quarter" | "month";
  year: number;
  /** År: 0. Kvartal: 1–4. Måned: 1–12. */
  index: number;
}

/**
 * Siste måned vi forventer dekning for. En måned er «forfalt» når det har
 * gått mer enn 45 dager siden månedsslutt — samme frist som oppdateringsalderen.
 */
export function expectedCommercialPeriod(now: Date): { year: number; month: number } {
  const due = new Date(now.getTime() - COMMERCIAL_STALE_DAYS * MS_PER_DAY);
  let year = due.getUTCFullYear();
  let month = due.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (due.getUTCDate() < lastDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return { year, month };
}

export function assessTmfDataAge(input: TmfDataAgeInput): TmfDataAgeReport {
  const items = [
    assessOfvInput("registrations", "Nyregistreringer", input.registrations, input.now),
    assessOfvInput("population", "Bestand", input.population, input.now),
    ...assessCommercial(input.commercial, input.now),
    ...assessSsb(input.ssbIndicators),
  ];

  return {
    items,
    warnings: items.filter((item) => item.status === "warn"),
  };
}

function assessOfvInput(
  id: string,
  label: string,
  freshness: TmfOfvFreshness | null,
  now: Date,
): TmfDataAgeItem {
  const observed = freshness?.publishDate ?? freshness?.syncedAt ?? null;
  if (!observed) {
    return {
      id,
      label,
      ageLabel: "mangler",
      status: "warn",
      detail: `${label} er ikke synket.`,
    };
  }

  const days = calendarDaysBetween(observed, now);
  if (days == null) {
    return {
      id,
      label,
      ageLabel: "ukjent alder",
      status: "warn",
      detail: `${label} har et tidsstempel som ikke kan leses.`,
    };
  }

  const ageDays = Math.max(0, days);
  const publish = freshness?.publishDate ? formatIsoDate(freshness.publishDate) : null;
  const synced = freshness?.syncedAt ? formatIsoDate(freshness.syncedAt) : null;
  const when = [
    publish ? `dato ${publish}` : null,
    synced ? `sist synket ${synced}` : null,
  ]
    .filter((part): part is string => part != null)
    .join(", ");

  if (ageDays > OFV_DATA_STALE_DAYS) {
    const old = ageDays === 1 ? "1 dag gammel" : `${ageDays} dager gammel`;
    return {
      id,
      label,
      ageLabel: agePhrase(ageDays),
      status: "warn",
      detail: `${label} er ${old} (${when}). Data eldre enn ${OFV_DATA_STALE_DAYS} dager bør sjekkes før budsjettet brukes.`,
    };
  }

  return {
    id,
    label,
    ageLabel: agePhrase(ageDays),
    status: "ok",
    detail: when || null,
  };
}

function assessCommercial(
  indicators: TmfCommercialIndicator[],
  now: Date,
): TmfDataAgeItem[] {
  const expected = expectedCommercialPeriod(now);
  const kinds: TmfCommercialKind[] = ["order_intake", "quote_activity"];

  return kinds.map((kind) => {
    const label = COMMERCIAL_KIND_LABELS[kind];
    const latest = latestOfKind(indicators, kind);
    const covers = latest != null && coversExpected(latest, expected);
    const updatedDays = latest ? daysSince(latest.updatedAt, now) : null;

    if (!latest) {
      return {
        id: `commercial:${kind}`,
        label,
        ageLabel: "mangler",
        status: "warn" as const,
        detail: `${label} er ikke ført inn. Forventet dekning gjennom ${monthName(expected.month)} ${expected.year}.`,
      };
    }

    if (!covers) {
      const updated =
        updatedDays == null
          ? ""
          : `, sist oppdatert ${agePhrase(Math.max(0, updatedDays))}`;
      return {
        id: `commercial:${kind}`,
        label,
        ageLabel: "mangler dekning",
        status: "warn" as const,
        detail: `${label} mangler for de siste månedene. Forventet dekning gjennom ${monthName(expected.month)} ${expected.year}, men siste tall er ${latest.periodYear} med ${latest.monthsCovered} måneder${updated}.`,
      };
    }

    if (updatedDays == null) {
      return {
        id: `commercial:${kind}`,
        label,
        ageLabel: "ukjent alder",
        status: "warn" as const,
        detail: `${label} for ${latest.periodYear} (${latest.monthsCovered} mnd) mangler tidspunkt for siste oppdatering.`,
      };
    }

    const ageDays = Math.max(0, updatedDays);
    if (updatedDays > COMMERCIAL_STALE_DAYS) {
      return {
        id: `commercial:${kind}`,
        label,
        ageLabel: agePhrase(ageDays),
        status: "warn" as const,
        detail: `${label} for ${latest.periodYear} (${latest.monthsCovered} mnd) er ikke oppdatert på ${ageDays} dager (sist ${formatIsoDate(latest.updatedAt)}). Grensen er ${COMMERCIAL_STALE_DAYS} dager.`,
      };
    }

    return {
      id: `commercial:${kind}`,
      label,
      ageLabel: agePhrase(ageDays),
      status: "ok" as const,
      detail: `${latest.periodYear}, ${latest.monthsCovered} av 12 måneder. Oppdatert ${formatIsoDate(latest.updatedAt)}.`,
    };
  });
}

function assessSsb(indicators: TmfSsbSeriesFreshness[]): TmfDataAgeItem[] {
  if (indicators.length === 0) {
    return [
      {
        id: "ssb",
        label: "SSB-indikatorer",
        ageLabel: "mangler",
        status: "warn",
        detail: "Ingen SSB-indikatorer er synket.",
      },
    ];
  }

  const parsed = indicators.map((indicator) => ({
    indicator,
    end: ssbPeriodEndUtc(indicator.latestPeriod),
    rank: ssbPeriodRank(indicator.latestPeriod),
  }));

  const dated = parsed.filter(
    (item): item is typeof item & { end: Date; rank: PeriodRank } =>
      item.end != null && item.rank != null,
  );

  const newest = dated.reduce<(typeof dated)[number] | null>((best, item) => {
    if (!best || item.end.getTime() > best.end.getTime()) return item;
    return best;
  }, null);

  const newestByType = new Map<PeriodRank["type"], (typeof dated)[number]>();
  for (const item of dated) {
    const current = newestByType.get(item.rank.type);
    if (!current || item.end.getTime() > current.end.getTime()) {
      newestByType.set(item.rank.type, item);
    }
  }

  return parsed.map((item) => {
    const periodLabel = formatDataAgePeriod(item.indicator.latestPeriod);
    const id = `ssb:${item.indicator.indicatorKey}`;

    if (!item.end || !item.rank || !newest) {
      return {
        id,
        label: item.indicator.label,
        ageLabel: periodLabel,
        status: "warn" as const,
        detail: `${item.indicator.label} har en periode som ikke kan sammenlignes (${item.indicator.latestPeriod}).`,
      };
    }

    const peer = newestByType.get(item.rank.type) ?? null;
    const globalMonths = wholeMonthsBetween(item.end, newest.end);
    const behindGlobal =
      newest.indicator.indicatorKey !== item.indicator.indicatorKey &&
      globalMonths >= SSB_CLEARLY_STALE_MONTHS;
    const steps = peer ? stepsBehind(item.rank, peer.rank) : 0;
    const behindPeer =
      peer != null &&
      peer.indicator.indicatorKey !== item.indicator.indicatorKey &&
      steps >= staleStepThreshold(item.rank.type);

    if (!behindGlobal && !behindPeer) {
      return {
        id,
        label: item.indicator.label,
        ageLabel: periodLabel,
        status: "ok" as const,
        detail: null,
      };
    }

    const reference = behindGlobal ? newest : peer;
    const referenceLabel = reference
      ? `${formatDataAgePeriod(reference.indicator.latestPeriod)} (${reference.indicator.label})`
      : "de andre seriene";
    const note = findSsbIndicatorSource(item.indicator.indicatorKey)?.stalenessNote;
    const sentence = `${item.indicator.label} har nyeste periode ${periodLabel}, mens de nyeste SSB-seriene går til ${referenceLabel}.`;

    return {
      id,
      label: item.indicator.label,
      ageLabel: periodLabel,
      status: "warn" as const,
      detail: note ? `${sentence} ${note}` : sentence,
    };
  });
}

function latestOfKind(
  indicators: TmfCommercialIndicator[],
  kind: TmfCommercialKind,
): TmfCommercialIndicator | null {
  let latest: TmfCommercialIndicator | null = null;
  for (const indicator of indicators) {
    if (indicator.kind !== kind) continue;
    if (!latest || indicator.periodYear > latest.periodYear) latest = indicator;
  }
  return latest;
}

function coversExpected(
  indicator: TmfCommercialIndicator,
  expected: { year: number; month: number },
): boolean {
  if (indicator.periodYear > expected.year) return true;
  return indicator.periodYear === expected.year && indicator.monthsCovered >= expected.month;
}

function staleStepThreshold(type: PeriodRank["type"]): number {
  if (type === "year") return 1;
  if (type === "quarter") return 2;
  return 4;
}

function stepsBehind(older: PeriodRank, newer: PeriodRank): number {
  if (older.type !== newer.type) return 0;
  if (older.type === "year") return newer.year - older.year;
  const span = older.type === "quarter" ? 4 : 12;
  return (newer.year - older.year) * span + (newer.index - older.index);
}

function wholeMonthsBetween(earlier: Date, later: Date): number {
  return (
    (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 +
    (later.getUTCMonth() - earlier.getUTCMonth())
  );
}

export function ssbPeriodEndUtc(period: string): Date | null {
  const month = period.match(/^(\d{4})M(\d{2})$/);
  if (month) {
    const year = Number(month[1]);
    const monthNumber = Number(month[2]);
    if (monthNumber < 1 || monthNumber > 12) return null;
    return new Date(Date.UTC(year, monthNumber, 0));
  }

  const quarter = period.match(/^(\d{4})K([1-4])$/);
  if (quarter) {
    return new Date(Date.UTC(Number(quarter[1]), Number(quarter[2]) * 3, 0));
  }

  if (/^\d{4}$/.test(period)) {
    return new Date(Date.UTC(Number(period), 12, 0));
  }

  return null;
}

function ssbPeriodRank(period: string): PeriodRank | null {
  const month = period.match(/^(\d{4})M(\d{2})$/);
  if (month) {
    const index = Number(month[2]);
    if (index < 1 || index > 12) return null;
    return { type: "month", year: Number(month[1]), index };
  }

  const quarter = period.match(/^(\d{4})K([1-4])$/);
  if (quarter) {
    return { type: "quarter", year: Number(quarter[1]), index: Number(quarter[2]) };
  }

  if (/^\d{4}$/.test(period)) {
    return { type: "year", year: Number(period), index: 0 };
  }

  return null;
}

export function formatDataAgePeriod(period: string): string {
  const month = period.match(/^(\d{4})M(\d{2})$/);
  if (month) {
    const name = MONTHS[Number(month[2]) - 1];
    return name ? `${name} ${month[1]}` : period;
  }
  const quarter = period.match(/^(\d{4})K([1-4])$/);
  if (quarter) return `${quarter[2]}. kvartal ${quarter[1]}`;
  return period;
}

function calendarDaysBetween(earlierIso: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(earlierIso);
  if (!match) return null;
  const thenUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((nowUtc - thenUtc) / MS_PER_DAY);
}

function daysSince(iso: string, now: Date): number | null {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((now.getTime() - timestamp) / MS_PER_DAY);
}

function agePhrase(days: number): string {
  if (days <= 0) return "i dag";
  if (days === 1) return "1 dag siden";
  return `${days} dager siden`;
}

function monthName(month: number): string {
  return MONTHS[month - 1] ?? String(month);
}

function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${Number(match[3])}. ${month} ${match[1]}`;
}
