import type { SsbDriverGroup } from "@/lib/ssb/queries";
import { forecastYearAtReference } from "@/lib/tmf/model";
import type { TmfCalibrationResult, TmfMonthlyMarketRow } from "@/lib/tmf/types";
import type { TmfDriverConfig } from "@/lib/tmf/drivers";

export const DRIVER_WEIGHT_CANDIDATES = [0.3, 0.4, 0.5, 0.6, 0.7] as const;

function yearFromMonth(month: string): number {
  return Number.parseInt(month.slice(0, 4), 10);
}

function meanAbsPctError(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function actualAnnualTotal(rows: TmfMonthlyMarketRow[], year: number): number {
  return rows
    .filter((row) => yearFromMonth(row.month) === year)
    .reduce((sum, row) => sum + row.count, 0);
}

function backtestYears(rows: TmfMonthlyMarketRow[], reference: Date): number[] {
  const years = rows.map((row) => yearFromMonth(row.month));
  const min = Math.min(...years);
  const last = reference.getFullYear() - 1;
  const list: number[] = [];
  for (let year = min + 1; year <= last; year += 1) list.push(year);
  return list;
}

function mapeForConfig(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  years: number[],
  config: TmfDriverConfig | null,
): number {
  const errors: number[] = [];
  for (const year of years) {
    const actual = actualAnnualTotal(rows, year);
    if (actual <= 0) continue;
    const forecast = forecastYearAtReference(
      rows,
      new Date(year, 0, 1),
      year,
      "basis",
      config == null ? [] : driverGroups,
      {},
      {},
      { applyTrend: false, driverConfig: config ?? undefined },
    );
    errors.push(Math.abs((forecast.total.annualMarket - actual) / actual) * 100);
  }
  return meanAbsPctError(errors);
}

/**
 * Velger SSB-signalvekt som minimerer historisk MAPE for full modell.
 * Sammenlignes mot OFV-kjerne (uten SSB).
 */
export function calibrateDriverWeight(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  reference = new Date(),
): TmfCalibrationResult {
  const years = backtestYears(rows, reference);
  const indexMin = 0.88;
  const indexMax = 1.12;

  const coreMape = mapeForConfig(rows, driverGroups, years, null);

  const candidates = DRIVER_WEIGHT_CANDIDATES.map((signalWeight) => ({
    signalWeight,
    mape: mapeForConfig(rows, driverGroups, years, {
      signalWeight,
      indexMin,
      indexMax,
    }),
  }));

  const best = candidates.reduce((winner, candidate) =>
    candidate.mape < winner.mape ? candidate : winner,
  );

  const beatsCore = best.mape + 0.25 < coreMape;
  const signalWeight = beatsCore ? best.signalWeight : Math.min(best.signalWeight, 0.4);

  return {
    signalWeight,
    indexMin,
    indexMax,
    mapeAtWeight: best.mape,
    coreMape,
    candidates,
    beatsCore,
    note: beatsCore
      ? `SSB-vekt ${signalWeight} gir lavest MAPE (${best.mape.toFixed(1)} %) og slår OFV-kjerne (${coreMape.toFixed(1)} %).`
      : `SSB forbedrer ikke MAPE vs. OFV-kjerne (${coreMape.toFixed(1)} %). Bruker dempet vekt ${signalWeight}.`,
  };
}
