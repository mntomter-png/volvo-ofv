import type { SsbDriverGroup } from "@/lib/ssb/queries";
import { asOfBacktestYears, asOfReferenceForTargetYear } from "@/lib/tmf/backtest-window";
import { forecastYearAtReference } from "@/lib/tmf/model";
import type { TmfCalibrationResult, TmfMonthlyMarketRow } from "@/lib/tmf/types";
import { DEFAULT_DRIVER_CONFIG, type TmfDriverConfig } from "@/lib/tmf/drivers";

export const DRIVER_WEIGHT_CANDIDATES = [0.3, 0.4, 0.5, 0.6, 0.7] as const;
export const MACRO_WEIGHT_CANDIDATES = [0, 0.15, 0.3, 0.45] as const;
export const TREND_WEIGHT_CANDIDATES = [0, 0.25, 0.5, 0.75, 1] as const;

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

function minDataYear(rows: TmfMonthlyMarketRow[]): number {
  return Math.min(...rows.map((row) => yearFromMonth(row.month)));
}

/**
 * MAPE for en konfigurasjon, målt på samme modell som leveres: prognosen kjørt
 * fra samme måned året før målåret, med den trendvekten som skal vurderes.
 */
function mapeForConfig(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  years: number[],
  asOfMonth: number,
  trendWeight: number,
  config: TmfDriverConfig | null,
): number {
  const errors: number[] = [];
  for (const year of years) {
    const actual = actualAnnualTotal(rows, year);
    if (actual <= 0) continue;
    const forecast = forecastYearAtReference(
      rows,
      asOfReferenceForTargetYear(year, asOfMonth),
      year,
      "basis",
      config == null ? [] : driverGroups,
      {},
      {},
      { applyTrend: trendWeight > 0, trendWeight, driverConfig: config ?? undefined },
    );
    errors.push(Math.abs((forecast.total.annualMarket - actual) / actual) * 100);
  }
  return meanAbsPctError(errors);
}

/**
 * Kalibrerer modellen mot historisk MAPE i to trinn:
 *
 * 1. Trendvekt — hvor mye av trend/YTD-utslaget som skal slippes gjennom.
 *    Kalibreres uten SSB, siden det er et spørsmål om modellstruktur.
 * 2. SSB-signalvekt og makrovekt, gitt den valgte trendvekten.
 *
 * Trinnvis i stedet for et felles rutenett fordi kalibreringen kjører per
 * forespørsel: 5 + 20 kjøringer i stedet for 100.
 */
export function calibrateDriverWeight(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  reference = new Date(),
): TmfCalibrationResult {
  const years = asOfBacktestYears(minDataYear(rows), reference);
  const asOfMonth = reference.getMonth() + 1;
  const indexMin = 0.88;
  const indexMax = 1.12;

  const trendCandidates = TREND_WEIGHT_CANDIDATES.map((trendWeight) => ({
    trendWeight,
    mape: mapeForConfig(rows, driverGroups, years, asOfMonth, trendWeight, null),
  }));

  const bestTrend = trendCandidates.reduce((winner, candidate) =>
    candidate.mape < winner.mape ? candidate : winner,
  );
  const trendWeight = bestTrend.trendWeight;
  const noSsbMape = bestTrend.mape;

  const candidates = DRIVER_WEIGHT_CANDIDATES.flatMap((signalWeight) =>
    MACRO_WEIGHT_CANDIDATES.map((macroWeight) => ({
      signalWeight,
      macroWeight,
      mape: mapeForConfig(rows, driverGroups, years, asOfMonth, trendWeight, {
        signalWeight,
        macroWeight,
        indexMin,
        indexMax,
      }),
    })),
  );

  const best = candidates.reduce((winner, candidate) =>
    candidate.mape < winner.mape ? candidate : winner,
  );

  const beatsNoSsb = best.mape + 0.25 < noSsbMape;
  // Uten dokumentert gevinst: hold igjen på signalvekten, men behold en moderat
  // makrovekt siden rente/BNP er strukturelt relevant for flåtefornyelse.
  const signalWeight = beatsNoSsb
    ? best.signalWeight
    : Math.min(best.signalWeight, DEFAULT_DRIVER_CONFIG.signalWeight);
  const macroWeight = beatsNoSsb
    ? best.macroWeight
    : Math.min(best.macroWeight, DEFAULT_DRIVER_CONFIG.macroWeight);

  const trendNote =
    trendWeight === 0
      ? `Trend/YTD er slått av: historisk gir hver økning i trendvekt høyere MAPE (${trendCandidates.map((candidate) => `${candidate.trendWeight}→${candidate.mape.toFixed(1)} %`).join(", ")}). Baseline + sesong treffer best på ${years.length} målår.`
      : `Trendvekt ${trendWeight} gir lavest MAPE (${noSsbMape.toFixed(1)} %) av kandidatene ${trendCandidates.map((candidate) => candidate.trendWeight).join("/")}.`;

  return {
    signalWeight,
    macroWeight,
    trendWeight,
    indexMin,
    indexMax,
    mapeAtWeight: best.mape,
    noSsbMape,
    candidates,
    trendCandidates,
    beatsNoSsb,
    note: `${trendNote} ${
      beatsNoSsb
        ? `SSB-vekt ${signalWeight} med makrovekt ${macroWeight} gir lavest MAPE (${best.mape.toFixed(1)} %) og slår modellen uten SSB.`
        : `SSB forbedrer ikke MAPE vs. samme modell uten SSB (${noSsbMape.toFixed(1)} %); bruker dempet vekt ${signalWeight} og makrovekt ${macroWeight}.`
    }`,
  };
}
