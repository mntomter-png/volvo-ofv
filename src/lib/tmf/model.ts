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
import { computeSegmentTrend, computeVolvoShareTrend, toTrendInfo } from "@/lib/tmf/trend";
import {
  buildCommercialSignal,
  NEUTRAL_COMMERCIAL_SIGNAL,
  type TmfCommercialIndicator,
  type TmfCommercialSignal,
} from "@/lib/tmf/commercial";
import { buildConfidenceBands, type TmfScenarioEnvelopeInput } from "@/lib/tmf/confidence";
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
  /**
   * Hvor mye av volumtrenden (CAGR + YTD) som slippes gjennom (0–1).
   * 1 = fullt utslag, 0 = trend av. Kalibreres mot MAPE på markedet.
   */
  trendWeight?: number;
  /**
   * Hvor mye av YTD-momentumet i Volvo-andelen som slippes gjennom (0–1).
   * Egen vekt fordi den kalibreres mot feil på Volvo-volum, ikke på markedet.
   */
  shareTrendWeight?: number;
  driverConfig?: TmfDriverConfig;
  /**
   * Kommersielt signal fra ordreinngang/tilbudsaktivitet. Legges på Volvo-volum,
   * ikke på markedet: det er Volvos egne ordre, så de sier noe om Volvos
   * leveranser og dermed andelen — ikke om totalmarkedet.
   */
  commercialSignal?: TmfCommercialSignal;
}

/** Kalibrerte vekter som avgjør hvor mye av hvert momentumledd som brukes. */
export interface TmfModelWeights {
  trendWeight: number;
  shareTrendWeight: number;
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

function sumEmobCounts(rows: TmfMonthlyMarketRow[]): number {
  return rows.reduce((sum, row) => sum + (row.emob_count ?? 0), 0);
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
  const emobTrailing12Total = sumEmobCounts(trailing);

  return {
    pabygg,
    trailing12Total,
    monthlyAverage: trailing12Total / BASELINE_MONTH_COUNT,
    volvoTrailing12Total,
    volvoSharePct: trailing12Total > 0 ? (volvoTrailing12Total / trailing12Total) * 100 : 0,
    emobTrailing12Total,
    emobSharePct: trailing12Total > 0 ? (emobTrailing12Total / trailing12Total) * 100 : 0,
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

/**
 * Anslag for hvor inneværende år lander: faktiske tall til og med siste
 * fullførte måned, prognose for de gjenstående. Inneværende måned regnes som
 * ufullstendig og prognoseres, ellers ville anslaget bli for lavt.
 */
function landingEstimate(
  monthly: TmfMonthlyPoint[],
  actualThroughMonth: number,
): number {
  return monthly.reduce((sum, point) => {
    const useActual = point.month <= actualThroughMonth && point.actual != null;
    return sum + (useActual ? point.actual! : point.adjustedForecast);
  }, 0);
}

/** Summer faktiske registreringer per måned for året før `year`. */
function priorYearMonthlyActuals(
  rows: TmfMonthlyMarketRow[],
  year: number,
): (number | null)[] {
  const priorYear = year - 1;
  const byMonth = new Map<number, number>();
  for (const row of rows) {
    const parsed = parseMonth(row.month);
    if (parsed.year !== priorYear) continue;
    byMonth.set(parsed.month, (byMonth.get(parsed.month) ?? 0) + row.count);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return byMonth.has(month) ? byMonth.get(month)! : null;
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
    const ssbIndex = getDriverIndexForPabygg(pabygg, driverIndices, driverConfig);
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
  const lastComplete = lastCompleteMonth(reference);
  const actualThroughMonth = lastComplete.year === year ? lastComplete.month : 0;

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
      annualLandingEstimate: landingEstimate(totalMonthly, actualThroughMonth),
      landingActualMonths: actualThroughMonth,
      priorYearMonthlyActual: priorYearMonthlyActuals(rows, year),
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
  // Vekter alene styrer hva som er aktivt. Tidligere avgjorde et eget
  // applyTrend-flagg andelsblendingen, som dermed kunne kjøre på full styrke
  // mens volumtrenden var kalibrert til null.
  const trendWeight = Math.max(0, Math.min(1, options.trendWeight ?? 0));
  const shareTrendWeight = Math.max(0, Math.min(1, options.shareTrendWeight ?? 0));
  const commercialSignal = options.commercialSignal ?? NEUTRAL_COMMERCIAL_SIGNAL;
  const driverConfig = options.driverConfig ?? DEFAULT_DRIVER_CONFIG;
  const years = seasonalityYears(reference);
  const driverIndices = computeDriverIndices(driverGroups, driverConfig);
  const segmentsInData = new Set(rows.map((row) => row.pabygg));
  const segmentList = ALL_PABYGG_SEGMENTS.filter((segment) => segmentsInData.has(segment));

  const segments: TmfYearEstimateSegment[] = segmentList.map((pabygg) => {
    const tmfDriver = PABYGG_TO_TMF_DRIVER[pabygg];
    const ssbIndex = getDriverIndexForPabygg(pabygg, driverIndices, driverConfig);
    const driverMultiplier = combinedDriverMultiplier(scenarioId, tmfDriver, ssbIndex);
    const analystAdjustmentPct = segmentAdjustments[pabygg] ?? 0;
    const baseline = computeBaseline(rows, pabygg, reference);
    const trend = computeSegmentTrend(rows, pabygg, reference);
    const trendMultiplier = 1 + trendWeight * (trend.nextYearMultiplier - 1);
    const scaledBaseline: TmfSegmentBaseline = {
      ...baseline,
      monthlyAverage: baseline.monthlyAverage * trendMultiplier,
    };
    // Volvo-andel får YTD-momentum etter egen kalibrert vekt, så et raskt
    // skifte i andel ikke blir liggende igjen i trailing-vinduet.
    const shareTrend = computeVolvoShareTrend(
      rows,
      pabygg,
      baseline.volvoSharePct,
      reference,
      shareTrendWeight,
    );
    const modelSharePct = resolveVolvoSharePct(
      shareTrend.effectivePct,
      pabygg,
      volvoShareOverrides,
    );
    // Ordreinngang løfter Volvo-volum, og dermed andelen. Har analytikeren satt
    // andelen selv, har de tatt over styringen og signalet skal ikke overstyre.
    const overridden = volvoShareOverrides[pabygg] != null;
    const volvoSharePct = overridden
      ? modelSharePct
      : Math.max(0, Math.min(100, modelSharePct * commercialSignal.multiplier));
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
    const emobSharePct = baseline.emobSharePct;
    const annualEmob = annualMarket * (emobSharePct / 100);

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
      volvoShareOverridden: overridden,
      /** Andel før ordreinngangssignalet, så bidraget kan leses av. */
      volvoShareBeforeCommercialPct: modelSharePct,
      volvoShareTrailingPct: shareTrend.trailingPct,
      volvoShareYtdPct: shareTrend.ytdPct,
      volvoShareYtdWeight: shareTrendWeight * shareTrend.ytdWeight,
      volvoShareMonthsUsed: shareTrend.ytdMonthsUsed,
      emobSharePct,
      annualEmob,
      annualIce: annualMarket - annualEmob,
      trend: toTrendInfo(trend),
    };
  });

  const totalMonthly = aggregateMonthly(segments.map((segment) => segment.monthly));
  const annualMarket = segments.reduce((sum, segment) => sum + segment.annualMarket, 0);
  const annualVolvo = segments.reduce((sum, segment) => sum + segment.annualVolvo, 0);
  const annualEmob = segments.reduce((sum, segment) => sum + segment.annualEmob, 0);

  return {
    year,
    segments,
    trendApplied: trendWeight > 0,
    trendWeight,
    shareTrendWeight,
    commercialSignal,
    total: {
      monthly: totalMonthly,
      annualMarket,
      annualVolvo,
      volvoSharePct: annualMarket > 0 ? (annualVolvo / annualMarket) * 100 : 0,
      annualEmob,
      annualIce: annualMarket - annualEmob,
      emobSharePct: annualMarket > 0 ? (annualEmob / annualMarket) * 100 : 0,
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
  weights: TmfModelWeights,
  commercialSignal: TmfCommercialSignal,
): TmfYearEstimate {
  return forecastYearAtReference(
    rows,
    reference,
    reference.getFullYear() + 1,
    scenarioId,
    driverGroups,
    segmentAdjustments,
    volvoShareOverrides,
    { ...weights, driverConfig, commercialSignal },
  );
}

function toCalibrationInfo(calibration: TmfCalibrationResult) {
  return {
    signalWeight: calibration.signalWeight,
    macroWeight: calibration.macroWeight,
    trendWeight: calibration.trendWeight,
    shareTrendWeight: calibration.shareTrendWeight,
    volvoMapeAtWeight: calibration.volvoMapeAtWeight,
    volvoMapeTrailing: calibration.volvoMapeTrailing,
    shareCandidates: calibration.shareCandidates,
    indexMin: calibration.indexMin,
    indexMax: calibration.indexMax,
    mapeAtWeight: calibration.mapeAtWeight,
    noSsbMape: calibration.noSsbMape,
    beatsNoSsb: calibration.beatsNoSsb,
    note: calibration.note,
    candidates: calibration.candidates,
    trendCandidates: calibration.trendCandidates,
  };
}

/** Spennet mellom basis, optimistisk og konservativt scenario, totalt og per segment. */
function buildScenarioEnvelope(
  basis: TmfYearEstimate,
  optimistic: TmfYearEstimate,
  conservative: TmfYearEstimate,
): TmfScenarioEnvelopeInput {
  const variants = [basis, optimistic, conservative];
  const segments: TmfScenarioEnvelopeInput["segments"] = {};

  for (const segment of basis.segments) {
    const key = String(segment.pabygg);
    const matches = variants
      .map((variant) => variant.segments.find((row) => String(row.pabygg) === key))
      .filter((row): row is TmfYearEstimateSegment => row != null);

    segments[key] = {
      low: Math.min(...matches.map((row) => row.annualMarket)),
      high: Math.max(...matches.map((row) => row.annualMarket)),
      volvoLow: Math.min(...matches.map((row) => row.annualVolvo)),
      volvoHigh: Math.max(...matches.map((row) => row.annualVolvo)),
    };
  }

  return {
    low: Math.min(...variants.map((variant) => variant.total.annualMarket)),
    high: Math.max(...variants.map((variant) => variant.total.annualMarket)),
    volvoLow: Math.min(...variants.map((variant) => variant.total.annualVolvo)),
    volvoHigh: Math.max(...variants.map((variant) => variant.total.annualVolvo)),
    segments,
  };
}

export function buildTmfEstimate(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  input: TmfEstimateInput,
  reference = new Date(),
  backtest: TmfBacktestResult | null = null,
  calibration: TmfCalibrationResult | null = null,
  commercialIndicators: TmfCommercialIndicator[] = [],
): TmfEstimateResult {
  const scenario = getTmfScenario(input.scenarioId);
  const driverConfig = calibration
    ? driverConfigFromCalibration(calibration)
    : DEFAULT_DRIVER_CONFIG;
  const driverIndices = computeDriverIndices(driverGroups, driverConfig);
  const weights: TmfModelWeights = {
    trendWeight: calibration?.trendWeight ?? 0,
    shareTrendWeight: calibration?.shareTrendWeight ?? 0,
  };
  const commercialSignal = buildCommercialSignal(
    commercialIndicators,
    reference.getFullYear(),
  );
  const forecastOptions = { ...weights, driverConfig, commercialSignal };

  const nextYear = buildNextYearEstimate(
    rows,
    reference,
    input.scenarioId,
    driverGroups,
    input.segmentAdjustments,
    input.volvoShareOverrides,
    driverConfig,
    weights,
    commercialSignal,
  );

  const optimistic = forecastYearAtReference(
    rows,
    reference,
    reference.getFullYear() + 1,
    "optimistic",
    driverGroups,
    input.segmentAdjustments,
    input.volvoShareOverrides,
    forecastOptions,
  );
  const conservative = forecastYearAtReference(
    rows,
    reference,
    reference.getFullYear() + 1,
    "conservative",
    driverGroups,
    input.segmentAdjustments,
    input.volvoShareOverrides,
    forecastOptions,
  );

  const scenarioEnvelope = {
    optimisticMarket: optimistic.total.annualMarket,
    conservativeMarket: conservative.total.annualMarket,
    optimisticVolvo: optimistic.total.annualVolvo,
    conservativeVolvo: conservative.total.annualVolvo,
  };

  const confidence = buildConfidenceBands(
    nextYear,
    buildScenarioEnvelope(nextYear, optimistic, conservative),
    backtest,
  );

  return {
    scenario: input.scenarioId,
    scenarioLabel: scenario.label,
    segmentAdjustments: input.segmentAdjustments,
    volvoShareOverrides: input.volvoShareOverrides,
    commercialIndicators,
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
          macroWeight: driverConfig.macroWeight,
          trendWeight: weights.trendWeight,
          shareTrendWeight: weights.shareTrendWeight,
          indexMin: driverConfig.indexMin,
          indexMax: driverConfig.indexMax,
          mapeAtWeight: 0,
          noSsbMape: 0,
          volvoMapeAtWeight: 0,
          volvoMapeTrailing: 0,
          beatsNoSsb: false,
          trendCandidates: [],
          shareCandidates: [],
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
