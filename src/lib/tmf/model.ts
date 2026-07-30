import {
  ALL_PABYGG_SEGMENTS,
  getPabyggSegmentLabel,
  type PabyggSegment,
} from "@/lib/ofv/segmentation";
import type { SsbDriverGroup } from "@/lib/ssb/queries";
import {
  computeDriverIndices,
  getDriverIndexForPabygg,
  PABYGG_TO_TMF_DRIVER,
  type TmfDriverConfig,
  DEFAULT_DRIVER_CONFIG,
  driverConfigFromCalibration,
} from "@/lib/tmf/drivers";
import {
  analystMultiplier,
  resolveVolvoSharePct,
  type TmfEstimateInput,
  type TmfSegmentAdjustments,
  type TmfVolvoShareOverrides,
} from "@/lib/tmf/adjustments";
import {
  combinedDriverMultiplier,
  getTmfScenario,
  type TmfScenarioId,
} from "@/lib/tmf/scenarios";
import { computeSegmentTrend, toTrendInfo } from "@/lib/tmf/trend";
import { buildConfidenceBands } from "@/lib/tmf/confidence";
import type {
  TmfBacktestResult,
  TmfCalibrationResult,
  TmfEstimateResult,
  TmfForecastResult,
  TmfMonthlyMarketRow,
  TmfMonthlyPoint,
  TmfSeasonalFactor,
  TmfSegmentBaseline,
  TmfSegmentForecast,
  TmfYearEstimate,
  TmfYearEstimateSegment,
} from "@/lib/tmf/types";

export interface TmfForecastOptions {
  applyTrend?: boolean;
  driverConfig?: TmfDriverConfig;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

const SEASONALITY_YEAR_COUNT = 5;
const BASELINE_MONTH_COUNT = 12;

function parseMonth(isoDate: string): { year: number; month: number } {
  return {
    year: Number.parseInt(isoDate.slice(0, 4), 10),
    month: Number.parseInt(isoDate.slice(5, 7), 10),
  };
}

function lastCompleteMonth(reference: Date): { year: number; month: number } {
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1;
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function rowsForSegment(
  rows: TmfMonthlyMarketRow[],
  pabygg: PabyggSegment | string,
): TmfMonthlyMarketRow[] {
  return rows.filter((row) => row.pabygg === pabygg);
}

function sumCounts(rows: TmfMonthlyMarketRow[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

function sumVolvoCounts(rows: TmfMonthlyMarketRow[]): number {
  return rows.reduce((sum, row) => sum + row.volvo_count, 0);
}

function computeBaseline(
  rows: TmfMonthlyMarketRow[],
  pabygg: PabyggSegment | string,
  reference: Date,
): TmfSegmentBaseline {
  const segmentRows = rowsForSegment(rows, pabygg);
  const end = lastCompleteMonth(reference);
  const start = addMonths(end.year, end.month, -(BASELINE_MONTH_COUNT - 1));

  const trailing = segmentRows.filter((row) => {
    const { year, month } = parseMonth(row.month);
    const key = year * 12 + month;
    const startKey = start.year * 12 + start.month;
    const endKey = end.year * 12 + end.month;
    return key >= startKey && key <= endKey;
  });

  const trailing12Total = sumCounts(trailing);
  const volvoTrailing12Total = sumVolvoCounts(trailing);

  return {
    pabygg,
    trailing12Total,
    monthlyAverage: trailing12Total / BASELINE_MONTH_COUNT,
    volvoTrailing12Total,
    volvoSharePct: trailing12Total > 0 ? (volvoTrailing12Total / trailing12Total) * 100 : 0,
  };
}

function seasonalityYears(reference: Date): number[] {
  const lastComplete = lastCompleteMonth(reference);
  const lastSeasonalityYear =
    lastComplete.month === 12 ? lastComplete.year : lastComplete.year - 1;
  const years: number[] = [];
  for (let i = SEASONALITY_YEAR_COUNT - 1; i >= 0; i -= 1) {
    years.push(lastSeasonalityYear - i);
  }
  return years;
}

function computeSeasonalFactors(
  rows: TmfMonthlyMarketRow[],
  pabygg: PabyggSegment | string,
  years: number[],
): TmfSeasonalFactor[] {
  const segmentRows = rowsForSegment(rows, pabygg).filter((row) => {
    const { year } = parseMonth(row.month);
    return years.includes(year);
  });

  const totalsByMonth = new Map<number, number[]>();
  for (const row of segmentRows) {
    const { month } = parseMonth(row.month);
    const list = totalsByMonth.get(month) ?? [];
    list.push(row.count);
    totalsByMonth.set(month, list);
  }

  const monthlyAverages = new Map<number, number>();
  for (const [month, values] of totalsByMonth) {
    monthlyAverages.set(month, values.reduce((a, b) => a + b, 0) / values.length);
  }

  const overallAverage =
    [...monthlyAverages.values()].reduce((a, b) => a + b, 0) /
    Math.max(monthlyAverages.size, 1);

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const avg = monthlyAverages.get(month) ?? overallAverage;
    const factor = overallAverage > 0 ? avg / overallAverage : 1;
    return { month, factor };
  });
}

function buildMonthlyPoints(
  rows: TmfMonthlyMarketRow[],
  pabygg: PabyggSegment | string,
  year: number,
  baseline: TmfSegmentBaseline,
  seasonalFactors: TmfSeasonalFactor[],
  reference: Date,
  driverMultiplier: number,
  analystAdjustmentPct: number,
  includeActuals: boolean,
): TmfMonthlyPoint[] {
  const segmentRows = rowsForSegment(rows, pabygg);
  const currentMonth = reference.getMonth() + 1;
  const factorByMonth = new Map(seasonalFactors.map((f) => [f.month, f.factor]));
  const totalMultiplier = driverMultiplier * analystMultiplier(analystAdjustmentPct);

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const actualRow = segmentRows.find((row) => {
      const parsed = parseMonth(row.month);
      return parsed.year === year && parsed.month === month;
    });
    const isPastOrCurrent =
      includeActuals &&
      (year < reference.getFullYear() ||
        (year === reference.getFullYear() && month <= currentMonth));
    const actual = isPastOrCurrent ? (actualRow?.count ?? 0) : null;
    const forecast = baseline.monthlyAverage * (factorByMonth.get(month) ?? 1);
    const adjustedForecast = forecast * totalMultiplier;

    return {
      month,
      monthLabel: MONTH_LABELS[index] ?? String(month),
      actual,
      forecast,
      adjustedForecast,
    };
  });
}

function aggregateMonthly(pointsList: TmfMonthlyPoint[][]): TmfMonthlyPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const points = pointsList.map((list) => list[index]).filter(Boolean) as TmfMonthlyPoint[];
    return {
      month,
      monthLabel: MONTH_LABELS[index] ?? String(month),
      actual: points.some((p) => p.actual != null)
        ? points.reduce((sum, p) => sum + (p.actual ?? 0), 0)
        : null,
      forecast: points.reduce((sum, p) => sum + p.forecast, 0),
      adjustedForecast: points.reduce((sum, p) => sum + p.adjustedForecast, 0),
    };
  });
}

function buildCurrentYearForecast(
  rows: TmfMonthlyMarketRow[],
  reference: Date,
  scenarioId: TmfScenarioId,
  driverGroups: SsbDriverGroup[],
  segmentAdjustments: TmfSegmentAdjustments,
  driverConfig: TmfDriverConfig,
): TmfForecastResult {
  const year = reference.getFullYear();
  const years = seasonalityYears(reference);
  const scenario = getTmfScenario(scenarioId);
  const driverIndices = computeDriverIndices(driverGroups, driverConfig);
  const segmentsInData = new Set(rows.map((row) => row.pabygg));
  const segmentList = ALL_PABYGG_SEGMENTS.filter((segment) => segmentsInData.has(segment));
  const currentMonth = reference.getMonth() + 1;

  const segments: TmfSegmentForecast[] = segmentList.map((pabygg) => {
    const tmfDriver = PABYGG_TO_TMF_DRIVER[pabygg];
    const ssbIndex = getDriverIndexForPabygg(pabygg, driverIndices);
    const driverMultiplier = combinedDriverMultiplier(scenarioId, tmfDriver, ssbIndex);
    const analystAdjustmentPct = segmentAdjustments[pabygg] ?? 0;
    const totalMultiplier = driverMultiplier * analystMultiplier(analystAdjustmentPct);
    const baseline = computeBaseline(rows, pabygg, reference);
    const seasonalFactors = computeSeasonalFactors(rows, pabygg, years);
    const monthly = buildMonthlyPoints(
      rows,
      pabygg,
      year,
      baseline,
      seasonalFactors,
      reference,
      driverMultiplier,
      analystAdjustmentPct,
      true,
    );

    return {
      pabygg,
      label: getPabyggSegmentLabel(pabygg),
      tmfDriver,
      driverMultiplier: totalMultiplier,
      analystAdjustmentPct,
      baseline,
      seasonalFactors,
      monthly,
      ytdActual: monthly
        .filter((point) => point.month <= currentMonth)
        .reduce((sum, point) => sum + (point.actual ?? 0), 0),
      ytdForecast: monthly
        .filter((point) => point.month <= currentMonth)
        .reduce((sum, point) => sum + point.forecast, 0),
      ytdAdjustedForecast: monthly
        .filter((point) => point.month <= currentMonth)
        .reduce((sum, point) => sum + point.adjustedForecast, 0),
      annualForecast: monthly.reduce((sum, point) => sum + point.forecast, 0),
      annualAdjustedForecast: monthly.reduce((sum, point) => sum + point.adjustedForecast, 0),
    };
  });

  const totalMonthly = aggregateMonthly(segments.map((segment) => segment.monthly));

  return {
    year,
    generatedAt: reference.toISOString(),
    seasonalityYears: years,
    scenario: scenarioId,
    scenarioLabel: scenario.label,
    segments,
    total: {
      monthly: totalMonthly,
      ytdActual: totalMonthly
        .filter((point) => point.month <= currentMonth)
        .reduce((sum, point) => sum + (point.actual ?? 0), 0),
      ytdForecast: totalMonthly
        .filter((point) => point.month <= currentMonth)
        .reduce((sum, point) => sum + point.forecast, 0),
      ytdAdjustedForecast: totalMonthly
        .filter((point) => point.month <= currentMonth)
        .reduce((sum, point) => sum + point.adjustedForecast, 0),
      annualForecast: totalMonthly.reduce((sum, point) => sum + point.forecast, 0),
      annualAdjustedForecast: totalMonthly.reduce(
        (sum, point) => sum + point.adjustedForecast,
        0,
      ),
    },
  };
}

/** Årsprognose ut fra data tilgjengelig ved `reference` (typisk 1. januar i målåret). */
export function forecastYearAtReference(
  rows: TmfMonthlyMarketRow[],
  reference: Date,
  targetYear: number,
  scenarioId: TmfScenarioId,
  driverGroups: SsbDriverGroup[],
  segmentAdjustments: TmfSegmentAdjustments,
  volvoShareOverrides: TmfVolvoShareOverrides,
  options: TmfForecastOptions = {},
): TmfYearEstimate {
  const year = targetYear;
  const applyTrend = options.applyTrend ?? false;
  const driverConfig = options.driverConfig ?? DEFAULT_DRIVER_CONFIG;
  const years = seasonalityYears(reference);
  const driverIndices = computeDriverIndices(driverGroups, driverConfig);
  const segmentsInData = new Set(rows.map((row) => row.pabygg));
  const segmentList = ALL_PABYGG_SEGMENTS.filter((segment) => segmentsInData.has(segment));

  const segments: TmfYearEstimateSegment[] = segmentList.map((pabygg) => {
    const tmfDriver = PABYGG_TO_TMF_DRIVER[pabygg];
    const ssbIndex = getDriverIndexForPabygg(pabygg, driverIndices);
    const driverMultiplier = combinedDriverMultiplier(scenarioId, tmfDriver, ssbIndex);
    const analystAdjustmentPct = segmentAdjustments[pabygg] ?? 0;
    const baseline = computeBaseline(rows, pabygg, reference);
    const trend = computeSegmentTrend(rows, pabygg, reference);
    const trendMultiplier = applyTrend ? trend.nextYearMultiplier : 1;
    const scaledBaseline: TmfSegmentBaseline = {
      ...baseline,
      monthlyAverage: baseline.monthlyAverage * trendMultiplier,
    };
    const volvoSharePct = resolveVolvoSharePct(
      baseline.volvoSharePct,
      pabygg,
      volvoShareOverrides,
    );
    const seasonalFactors = computeSeasonalFactors(rows, pabygg, years);
    const monthly = buildMonthlyPoints(
      rows,
      pabygg,
      year,
      scaledBaseline,
      seasonalFactors,
      reference,
      driverMultiplier,
      analystAdjustmentPct,
      false,
    );
    const annualMarket = monthly.reduce((sum, point) => sum + point.adjustedForecast, 0);

    return {
      pabygg,
      label: getPabyggSegmentLabel(pabygg),
      tmfDriver,
      driverMultiplier: driverMultiplier * analystMultiplier(analystAdjustmentPct),
      analystAdjustmentPct,
      monthly,
      annualMarket,
      annualVolvo: annualMarket * (volvoSharePct / 100),
      volvoSharePct,
      volvoShareOverridden: volvoShareOverrides[pabygg] != null,
      trend: toTrendInfo(trend),
    };
  });

  const totalMonthly = aggregateMonthly(segments.map((segment) => segment.monthly));
  const annualMarket = segments.reduce((sum, segment) => sum + segment.annualMarket, 0);
  const annualVolvo = segments.reduce((sum, segment) => sum + segment.annualVolvo, 0);

  return {
    year,
    segments,
    trendApplied: applyTrend,
    total: {
      monthly: totalMonthly,
      annualMarket,
      annualVolvo,
      volvoSharePct: annualMarket > 0 ? (annualVolvo / annualMarket) * 100 : 0,
    },
  };
}

function buildNextYearEstimate(
  rows: TmfMonthlyMarketRow[],
  reference: Date,
  scenarioId: TmfScenarioId,
  driverGroups: SsbDriverGroup[],
  segmentAdjustments: TmfSegmentAdjustments,
  volvoShareOverrides: TmfVolvoShareOverrides,
  driverConfig: TmfDriverConfig,
): TmfYearEstimate {
  return forecastYearAtReference(
    rows,
    reference,
    reference.getFullYear() + 1,
    scenarioId,
    driverGroups,
    segmentAdjustments,
    volvoShareOverrides,
    { applyTrend: true, driverConfig },
  );
}

function toCalibrationInfo(calibration: TmfCalibrationResult) {
  return {
    signalWeight: calibration.signalWeight,
    indexMin: calibration.indexMin,
    indexMax: calibration.indexMax,
    mapeAtWeight: calibration.mapeAtWeight,
    coreMape: calibration.coreMape,
    beatsCore: calibration.beatsCore,
    note: calibration.note,
    candidates: calibration.candidates,
  };
}

export function buildTmfEstimate(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  input: TmfEstimateInput,
  reference = new Date(),
  backtest: TmfBacktestResult | null = null,
  calibration: TmfCalibrationResult | null = null,
): TmfEstimateResult {
  const scenario = getTmfScenario(input.scenarioId);
  const driverConfig = calibration
    ? driverConfigFromCalibration(calibration)
    : DEFAULT_DRIVER_CONFIG;
  const driverIndices = computeDriverIndices(driverGroups, driverConfig);

  const nextYear = buildNextYearEstimate(
    rows,
    reference,
    input.scenarioId,
    driverGroups,
    input.segmentAdjustments,
    input.volvoShareOverrides,
    driverConfig,
  );

  const optimistic = forecastYearAtReference(
    rows,
    reference,
    reference.getFullYear() + 1,
    "optimistic",
    driverGroups,
    input.segmentAdjustments,
    input.volvoShareOverrides,
    { applyTrend: true, driverConfig },
  );
  const conservative = forecastYearAtReference(
    rows,
    reference,
    reference.getFullYear() + 1,
    "conservative",
    driverGroups,
    input.segmentAdjustments,
    input.volvoShareOverrides,
    { applyTrend: true, driverConfig },
  );

  const scenarioEnvelope = {
    optimisticMarket: optimistic.total.annualMarket,
    conservativeMarket: conservative.total.annualMarket,
    optimisticVolvo: optimistic.total.annualVolvo,
    conservativeVolvo: conservative.total.annualVolvo,
  };

  const confidence = buildConfidenceBands(
    nextYear,
    {
      low: Math.min(
        conservative.total.annualMarket,
        nextYear.total.annualMarket,
        optimistic.total.annualMarket,
      ),
      high: Math.max(
        conservative.total.annualMarket,
        nextYear.total.annualMarket,
        optimistic.total.annualMarket,
      ),
      volvoLow: Math.min(
        conservative.total.annualVolvo,
        nextYear.total.annualVolvo,
        optimistic.total.annualVolvo,
      ),
      volvoHigh: Math.max(
        conservative.total.annualVolvo,
        nextYear.total.annualVolvo,
        optimistic.total.annualVolvo,
      ),
    },
    backtest,
  );

  return {
    scenario: input.scenarioId,
    scenarioLabel: scenario.label,
    segmentAdjustments: input.segmentAdjustments,
    volvoShareOverrides: input.volvoShareOverrides,
    currentYear: buildCurrentYearForecast(
      rows,
      reference,
      input.scenarioId,
      driverGroups,
      input.segmentAdjustments,
      driverConfig,
    ),
    nextYear,
    confidence,
    calibration: calibration
      ? toCalibrationInfo(calibration)
      : {
          signalWeight: driverConfig.signalWeight,
          indexMin: driverConfig.indexMin,
          indexMax: driverConfig.indexMax,
          mapeAtWeight: 0,
          coreMape: 0,
          beatsCore: false,
          note: "Standard driverkonfigurasjon (ikke kalibrert i denne kjøringen).",
          candidates: [],
        },
    scenarioEnvelope,
    driverIndices: Object.fromEntries(
      Object.entries(driverIndices).map(([driver, info]) => [
        driver,
        {
          index: info.index,
          avgChangePct: info.avgChangePct,
          indicatorCount: info.indicatorCount,
        },
      ]),
    ) as TmfEstimateResult["driverIndices"],
  };
}

/** @deprecated Bruk buildTmfEstimate */
export function buildTmfForecast(
  rows: TmfMonthlyMarketRow[],
  reference = new Date(),
): TmfForecastResult {
  return buildTmfEstimate(
    rows,
    [],
    { scenarioId: "basis", segmentAdjustments: {}, volvoShareOverrides: {} },
    reference,
  ).currentYear;
}
