import type { PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfMonthlyMarketRow, TmfSegmentTrendInfo } from "@/lib/tmf/types";

const TREND_YEAR_COUNT = 3;
/** Begrens årlig trend for å unngå overprojeksjon på kort historikk. */
const TREND_CAGR_MIN = -0.1;
const TREND_CAGR_MAX = 0.1;
/** Maks andel YTD kan utgjøre av blended trend (resten er historisk CAGR). */
const YTD_WEIGHT_MAX = 0.65;
/** Krever minst så mange fullførte måneder før YTD-momentum brukes. */
const YTD_MIN_MONTHS = 3;

export interface TmfSegmentTrend {
  pabygg: string;
  /** Historisk CAGR over fullførte kalenderår (f.eks. 0.03 = +3 %). */
  historicalCagr: number;
  historicalCagrPct: number;
  /** YTD YoY for inneværende år vs. samme måneder i fjor (null hvis ikke tilgjengelig). */
  ytdMomentum: number | null;
  ytdMomentumPct: number | null;
  /** Vekt på YTD i blend (0–YTD_WEIGHT_MAX). */
  ytdWeight: number;
  /** Antall fullførte måneder brukt i YTD. */
  ytdMonthsUsed: number;
  ytdCurrent: number;
  ytdPrior: number;
  /** Effektiv (blandet) trend brukt i prognosen. */
  cagr: number;
  cagrPct: number;
  /** Multiplikator for neste kalenderår (1 + cagr). */
  nextYearMultiplier: number;
  annualTotals: { year: number; total: number }[];
  yearsUsed: number[];
}

function yearFromMonth(month: string): number {
  return Number.parseInt(month.slice(0, 4), 10);
}

function monthFromMonth(month: string): number {
  return Number.parseInt(month.slice(5, 7), 10);
}

function lastCompleteCalendarYear(reference: Date): number {
  return reference.getFullYear() - 1;
}

/** Siste fullførte kalendermåned før reference (samme logikk som TMF-baseline). */
function lastCompleteMonth(reference: Date): { year: number; month: number } {
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1;
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function annualTotalForSegment(
  rows: TmfMonthlyMarketRow[],
  pabygg: string,
  year: number,
): number {
  return rows
    .filter((row) => row.pabygg === pabygg && yearFromMonth(row.month) === year)
    .reduce((sum, row) => sum + row.count, 0);
}

function sumSegmentMonths(
  rows: TmfMonthlyMarketRow[],
  pabygg: string,
  year: number,
  throughMonth: number,
): number {
  return rows
    .filter((row) => {
      if (row.pabygg !== pabygg) return false;
      if (yearFromMonth(row.month) !== year) return false;
      return monthFromMonth(row.month) <= throughMonth;
    })
    .reduce((sum, row) => sum + row.count, 0);
}

function clampCagr(value: number): number {
  return Math.max(TREND_CAGR_MIN, Math.min(TREND_CAGR_MAX, value));
}

function emptyTrend(
  pabygg: string,
  annualTotals: { year: number; total: number }[] = [],
  yearsUsed: number[] = [],
): TmfSegmentTrend {
  return {
    pabygg,
    historicalCagr: 0,
    historicalCagrPct: 0,
    ytdMomentum: null,
    ytdMomentumPct: null,
    ytdWeight: 0,
    ytdMonthsUsed: 0,
    ytdCurrent: 0,
    ytdPrior: 0,
    cagr: 0,
    cagrPct: 0,
    nextYearMultiplier: 1,
    annualTotals,
    yearsUsed,
  };
}

/**
 * YTD-momentum: YoY for fullførte måneder i inneværende år vs. samme periode i fjor.
 * Vekt øker med antall måneder (maks 65 %), så fersk utvikling kan dempe/overstyre
 * historisk CAGR uten å ignorere den helt.
 */
function computeYtdMomentum(
  rows: TmfMonthlyMarketRow[],
  pabygg: string,
  reference: Date,
): Pick<
  TmfSegmentTrend,
  | "ytdMomentum"
  | "ytdMomentumPct"
  | "ytdWeight"
  | "ytdMonthsUsed"
  | "ytdCurrent"
  | "ytdPrior"
> {
  const currentYear = reference.getFullYear();
  const end = lastCompleteMonth(reference);

  if (end.year !== currentYear || end.month < YTD_MIN_MONTHS) {
    return {
      ytdMomentum: null,
      ytdMomentumPct: null,
      ytdWeight: 0,
      ytdMonthsUsed: end.year === currentYear ? end.month : 0,
      ytdCurrent: 0,
      ytdPrior: 0,
    };
  }

  const ytdCurrent = sumSegmentMonths(rows, pabygg, currentYear, end.month);
  const ytdPrior = sumSegmentMonths(rows, pabygg, currentYear - 1, end.month);

  if (ytdPrior <= 0) {
    return {
      ytdMomentum: null,
      ytdMomentumPct: null,
      ytdWeight: 0,
      ytdMonthsUsed: end.month,
      ytdCurrent,
      ytdPrior,
    };
  }

  const ytdMomentum = (ytdCurrent - ytdPrior) / ytdPrior;
  const ytdWeight = Math.min(YTD_WEIGHT_MAX, end.month / 12);

  return {
    ytdMomentum,
    ytdMomentumPct: ytdMomentum * 100,
    ytdWeight,
    ytdMonthsUsed: end.month,
    ytdCurrent,
    ytdPrior,
  };
}

/**
 * Beregn segment-trend for neste år:
 * blend av historisk CAGR (opptil 3 fullførte år) og YTD-momentum.
 */
export function computeSegmentTrend(
  rows: TmfMonthlyMarketRow[],
  pabygg: PabyggSegment | string,
  reference = new Date(),
): TmfSegmentTrend {
  const lastYear = lastCompleteCalendarYear(reference);
  const yearsUsed: number[] = [];
  const annualTotals: { year: number; total: number }[] = [];

  for (let i = TREND_YEAR_COUNT - 1; i >= 0; i -= 1) {
    const year = lastYear - i;
    const total = annualTotalForSegment(rows, pabygg, year);
    if (total > 0) {
      yearsUsed.push(year);
      annualTotals.push({ year, total });
    }
  }

  const ytdInfo = computeYtdMomentum(rows, pabygg, reference);

  if (annualTotals.length < 2) {
    // Ren YTD hvis historikk mangler
    if (ytdInfo.ytdMomentum != null && ytdInfo.ytdWeight > 0) {
      const cagr = clampCagr(ytdInfo.ytdMomentum);
      return {
        ...emptyTrend(String(pabygg), annualTotals, yearsUsed),
        ...ytdInfo,
        historicalCagr: 0,
        historicalCagrPct: 0,
        cagr,
        cagrPct: cagr * 100,
        nextYearMultiplier: 1 + cagr,
      };
    }
    return { ...emptyTrend(String(pabygg), annualTotals, yearsUsed), ...ytdInfo };
  }

  const first = annualTotals[0]!;
  const last = annualTotals.at(-1)!;
  const span = last.year - first.year;
  if (span <= 0 || first.total <= 0) {
    return { ...emptyTrend(String(pabygg), annualTotals, yearsUsed), ...ytdInfo };
  }

  const rawCagr = Math.pow(last.total / first.total, 1 / span) - 1;
  const historicalCagr = clampCagr(rawCagr);

  let cagr = historicalCagr;
  if (ytdInfo.ytdMomentum != null && ytdInfo.ytdWeight > 0) {
    const ytdClamped = clampCagr(ytdInfo.ytdMomentum);
    cagr = clampCagr(
      (1 - ytdInfo.ytdWeight) * historicalCagr + ytdInfo.ytdWeight * ytdClamped,
    );
  }

  return {
    pabygg: String(pabygg),
    historicalCagr,
    historicalCagrPct: historicalCagr * 100,
    ...ytdInfo,
    cagr,
    cagrPct: cagr * 100,
    nextYearMultiplier: 1 + cagr,
    annualTotals,
    yearsUsed,
  };
}

export function toTrendInfo(trend: TmfSegmentTrend): TmfSegmentTrendInfo {
  return {
    cagrPct: trend.cagrPct,
    historicalCagrPct: trend.historicalCagrPct,
    ytdMomentumPct: trend.ytdMomentumPct,
    ytdWeight: trend.ytdWeight,
    ytdMonthsUsed: trend.ytdMonthsUsed,
    nextYearMultiplier: trend.nextYearMultiplier,
    yearsUsed: trend.yearsUsed,
  };
}
