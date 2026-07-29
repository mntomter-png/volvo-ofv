import type { PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfMonthlyMarketRow, TmfSegmentTrendInfo } from "@/lib/tmf/types";

const TREND_YEAR_COUNT = 3;
/** Begrens årlig trend for å unngå overprojeksjon på kort historikk. */
const TREND_CAGR_MIN = -0.1;
const TREND_CAGR_MAX = 0.1;

export interface TmfSegmentTrend {
  pabygg: string;
  /** Compound annual growth rate over kalibreringsårene (f.eks. 0.03 = +3 %). */
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

function lastCompleteCalendarYear(reference: Date): number {
  return reference.getFullYear() - 1;
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

function clampCagr(value: number): number {
  return Math.max(TREND_CAGR_MIN, Math.min(TREND_CAGR_MAX, value));
}

/**
 * Beregn CAGR for et segment over opptil 3 fullførte kalenderår.
 * Krever minst 2 år med positivt volum.
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

  if (annualTotals.length < 2) {
    return {
      pabygg,
      cagr: 0,
      cagrPct: 0,
      nextYearMultiplier: 1,
      annualTotals,
      yearsUsed,
    };
  }

  const first = annualTotals[0]!;
  const last = annualTotals.at(-1)!;
  const span = last.year - first.year;
  if (span <= 0 || first.total <= 0) {
    return {
      pabygg,
      cagr: 0,
      cagrPct: 0,
      nextYearMultiplier: 1,
      annualTotals,
      yearsUsed,
    };
  }

  const rawCagr = Math.pow(last.total / first.total, 1 / span) - 1;
  const cagr = clampCagr(rawCagr);

  return {
    pabygg,
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
    nextYearMultiplier: trend.nextYearMultiplier,
    yearsUsed: trend.yearsUsed,
  };
}
