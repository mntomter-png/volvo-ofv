import {
  ALL_PABYGG_SEGMENTS,
  getPabyggSegmentLabel,
  type PabyggSegment,
} from "@/lib/ofv/segmentation";
import { findSsbIndicatorSource, TMF_DRIVER_LABELS } from "@/lib/ssb/indicators";
import type { SsbDriverGroup, SsbIndicatorPoint } from "@/lib/ssb/queries";
import type { TmfDriver } from "@/lib/ssb/types";
import { PABYGG_TO_TMF_DRIVER } from "@/lib/tmf/drivers";
import type { TmfDriverConfig } from "@/lib/tmf/drivers";
import {
  asOfReferenceForTargetYear,
  firstAsOfBacktestYear,
  lastAsOfBacktestYear,
} from "@/lib/tmf/backtest-window";
import { forecastYearAtReference } from "@/lib/tmf/model";
import type {
  TmfBacktestModelId,
  TmfBacktestModelResult,
  TmfBacktestResult,
  TmfBacktestSegmentResult,
  TmfBacktestYearResult,
  TmfDriverCorrelation,
  TmfMonthlyMarketRow,
} from "@/lib/tmf/types";

function yearFromMonth(month: string): number {
  return Number.parseInt(month.slice(0, 4), 10);
}

function getDataYearRange(rows: TmfMonthlyMarketRow[]): { min: number; max: number } {
  const years = rows.map((row) => yearFromMonth(row.month));
  return { min: Math.min(...years), max: Math.max(...years) };
}

const MONTH_NAMES = [
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

interface SegmentActual {
  market: number;
  volvo: number;
}

function getActualAnnualBySegment(
  rows: TmfMonthlyMarketRow[],
  year: number,
): Map<string, SegmentActual> {
  const totals = new Map<string, SegmentActual>();
  for (const row of rows) {
    if (yearFromMonth(row.month) !== year) continue;
    const current = totals.get(row.pabygg) ?? { market: 0, volvo: 0 };
    current.market += row.count;
    current.volvo += row.volvo_count;
    totals.set(row.pabygg, current);
  }
  return totals;
}

/** Prosentavvik med faktisk som fasit: (faktisk − prognose) / faktisk.
 *  Negativt = markedet ble svakere enn prognosen (overestimering).
 *  Positivt = markedet ble sterkere enn prognosen (underestimering).
 */
function pctError(forecast: number, actual: number): number {
  if (actual === 0) return 0;
  return ((actual - forecast) / actual) * 100;
}

function absPctError(forecast: number, actual: number): number {
  return Math.abs(pctError(forecast, actual));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildYearResult(
  year: number,
  forecastSegments: {
    pabygg: string;
    label: string;
    annualMarket: number;
    annualVolvo: number;
  }[],
  actualBySegment: Map<string, SegmentActual>,
): TmfBacktestYearResult {
  const segments: TmfBacktestSegmentResult[] = forecastSegments.map((segment) => {
    const actual = actualBySegment.get(segment.pabygg) ?? { market: 0, volvo: 0 };
    return {
      pabygg: segment.pabygg,
      label: segment.label,
      forecast: segment.annualMarket,
      actual: actual.market,
      errorPct: pctError(segment.annualMarket, actual.market),
      absErrorPct: absPctError(segment.annualMarket, actual.market),
      volvoForecast: segment.annualVolvo,
      volvoActual: actual.volvo,
      volvoErrorPct: pctError(segment.annualVolvo, actual.volvo),
      volvoAbsErrorPct: absPctError(segment.annualVolvo, actual.volvo),
    };
  });

  const forecastTotal = segments.reduce((sum, segment) => sum + segment.forecast, 0);
  const actualTotal = segments.reduce((sum, segment) => sum + segment.actual, 0);
  const volvoForecastTotal = segments.reduce((sum, segment) => sum + segment.volvoForecast, 0);
  const volvoActualTotal = segments.reduce((sum, segment) => sum + segment.volvoActual, 0);

  return {
    year,
    forecastTotal,
    actualTotal,
    errorPct: pctError(forecastTotal, actualTotal),
    absErrorPct: absPctError(forecastTotal, actualTotal),
    volvoForecastTotal,
    volvoActualTotal,
    volvoErrorPct: pctError(volvoForecastTotal, volvoActualTotal),
    volvoAbsErrorPct: absPctError(volvoForecastTotal, volvoActualTotal),
    segments,
  };
}

/**
 * Deler signerte avvik i nedside (prognosen var for høy) og oppside.
 * Brukes til asymmetriske P10/P90-bånd. Faller tilbake til MAPE når en av
 * sidene ikke har observasjoner.
 */
function halfWidths(errors: number[], mape: number): { downsidePct: number; upsidePct: number } {
  const overshoot = errors.filter((value) => value < 0).map((value) => -value);
  const undershoot = errors.filter((value) => value > 0);
  return {
    downsidePct: overshoot.length > 0 ? mean(overshoot) : mape,
    upsidePct: undershoot.length > 0 ? mean(undershoot) : mape,
  };
}

function aggregateModelResult(
  modelId: TmfBacktestModelId,
  modelLabel: string,
  description: string,
  years: TmfBacktestYearResult[],
): TmfBacktestModelResult {
  const validYears = years.filter((year) => year.actualTotal > 0);
  const mapeBySegment: TmfBacktestModelResult["mapeBySegment"] = {};

  for (const segment of ALL_PABYGG_SEGMENTS) {
    const absErrors: number[] = [];
    const signedErrors: number[] = [];
    for (const year of validYears) {
      const segmentResult = year.segments.find((row) => row.pabygg === segment);
      if (!segmentResult || segmentResult.actual === 0) continue;
      absErrors.push(segmentResult.absErrorPct);
      signedErrors.push(segmentResult.errorPct);
    }
    if (absErrors.length > 0) {
      const segmentMape = mean(absErrors);
      mapeBySegment[segment] = {
        label: getPabyggSegmentLabel(segment),
        mape: segmentMape,
        observations: absErrors.length,
        ...halfWidths(signedErrors, segmentMape),
      };
    }
  }

  const mapeTotal = mean(validYears.map((year) => year.absErrorPct));

  const volvoYears = validYears.filter((year) => year.volvoActualTotal > 0);
  const volvoMapeTotal = mean(volvoYears.map((year) => year.volvoAbsErrorPct));
  const volvoHalves = halfWidths(
    volvoYears.map((year) => year.volvoErrorPct),
    volvoMapeTotal,
  );

  return {
    modelId,
    modelLabel,
    description,
    years,
    mapeTotal,
    biasPct: mean(validYears.map((year) => year.errorPct)),
    ...halfWidths(
      validYears.map((year) => year.errorPct),
      mapeTotal,
    ),
    volvoMapeTotal,
    volvoBiasPct: mean(volvoYears.map((year) => year.volvoErrorPct)),
    volvoDownsidePct: volvoHalves.downsidePct,
    volvoUpsidePct: volvoHalves.upsidePct,
    mapeBySegment,
  };
}

interface ModelBacktestOptions {
  trendWeight: number;
  shareTrendWeight: number;
  useDrivers: boolean;
  asOfMonth: number;
  driverConfig?: TmfDriverConfig;
}

function runModelBacktest(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  firstYear: number,
  lastYear: number,
  modelId: TmfBacktestModelId,
  modelLabel: string,
  description: string,
  options: ModelBacktestOptions,
): TmfBacktestModelResult {
  const groups = options.useDrivers ? driverGroups : [];
  const years: TmfBacktestYearResult[] = [];

  for (let year = firstYear; year <= lastYear; year += 1) {
    const forecast = forecastYearAtReference(
      rows,
      asOfReferenceForTargetYear(year, options.asOfMonth),
      year,
      "basis",
      groups,
      {},
      {},
      {
        trendWeight: options.trendWeight,
        shareTrendWeight: options.shareTrendWeight,
        driverConfig: options.useDrivers ? options.driverConfig : undefined,
      },
    );
    const actualBySegment = getActualAnnualBySegment(rows, year);
    years.push(
      buildYearResult(
        year,
        forecast.segments.map((segment) => ({
          pabygg: String(segment.pabygg),
          label: segment.label,
          annualMarket: segment.annualMarket,
          annualVolvo: segment.annualVolvo,
        })),
        actualBySegment,
      ),
    );
  }

  return aggregateModelResult(modelId, modelLabel, description, years);
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const meanX = mean(xs);
  const meanY = mean(ys);
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;
  return numerator / denom;
}

function annualValueFromPeriods(
  points: { period: string; value: number }[],
  year: number,
): number | null {
  const annual = points.find((point) => point.period === String(year));
  if (annual) return annual.value;

  const months = points.filter((point) => point.period.startsWith(`${year}M`));
  if (months.length > 0) {
    return months.reduce((sum, point) => sum + point.value, 0) / months.length;
  }

  const quarters = points.filter((point) => point.period.startsWith(`${year}K`));
  if (quarters.length === 0) return null;
  const q4 = quarters.find((point) => point.period.endsWith("K4"));
  if (q4) return q4.value;
  return quarters.reduce((sum, point) => sum + point.value, 0) / quarters.length;
}

function annualTotalsByDriver(
  rows: TmfMonthlyMarketRow[],
): Map<TmfDriver, Map<number, number>> {
  const byDriver = new Map<TmfDriver, Map<number, number>>();
  for (const driver of Object.keys(TMF_DRIVER_LABELS) as TmfDriver[]) {
    byDriver.set(driver, new Map());
  }

  for (const row of rows) {
    const driver = PABYGG_TO_TMF_DRIVER[row.pabygg as PabyggSegment] ?? "macro";
    const year = yearFromMonth(row.month);
    const yearMap = byDriver.get(driver)!;
    yearMap.set(year, (yearMap.get(year) ?? 0) + row.count);
  }

  return byDriver;
}

function yoySeries(totals: Map<number, number>): { year: number; changePct: number }[] {
  const years = [...totals.keys()].sort((a, b) => a - b);
  const series: { year: number; changePct: number }[] = [];
  for (let i = 1; i < years.length; i += 1) {
    const year = years[i]!;
    const previous = years[i - 1]!;
    const currentTotal = totals.get(year) ?? 0;
    const previousTotal = totals.get(previous) ?? 0;
    if (previousTotal === 0) continue;
    series.push({ year, changePct: ((currentTotal - previousTotal) / previousTotal) * 100 });
  }
  return series;
}

function analyzeDriverCorrelations(
  rows: TmfMonthlyMarketRow[],
  ssbPoints: SsbIndicatorPoint[],
): TmfDriverCorrelation[] {
  const registrationByDriver = annualTotalsByDriver(rows);
  const byKey = new Map<string, SsbIndicatorPoint[]>();
  for (const point of ssbPoints) {
    const list = byKey.get(point.indicator_key) ?? [];
    list.push(point);
    byKey.set(point.indicator_key, list);
  }

  const driverSsbYoY = new Map<TmfDriver, Map<number, number[]>>();

  for (const [indicatorKey, series] of byKey) {
    const driver = series[0]?.tmf_driver;
    if (!driver) continue;

    const invert = findSsbIndicatorSource(indicatorKey)?.invertSignal === true;

    const yearsInSeries = new Set<number>();
    for (const point of series) {
      const yearMatch = point.period.match(/^(\d{4})/);
      if (yearMatch) yearsInSeries.add(Number.parseInt(yearMatch[1]!, 10));
    }

    const annualValues = new Map<number, number>();
    const sortedPoints = series.map((row) => ({ period: row.period, value: row.value }));
    for (const year of yearsInSeries) {
      const value = annualValueFromPeriods(sortedPoints, year);
      if (value != null) annualValues.set(year, value);
    }

    const yoy = yoySeries(annualValues);
    const driverMap = driverSsbYoY.get(driver) ?? new Map<number, number[]>();
    for (const point of yoy) {
      const list = driverMap.get(point.year) ?? [];
      list.push(invert ? -point.changePct : point.changePct);
      driverMap.set(point.year, list);
    }
    driverSsbYoY.set(driver, driverMap);
  }

  const drivers: TmfDriver[] = ["construction", "distribution", "long_haul", "macro"];
  return drivers.map((driver) => {
    const regYoY = yoySeries(registrationByDriver.get(driver) ?? new Map());
    const ssbMap = driverSsbYoY.get(driver) ?? new Map();
    const ssbYoY = [...ssbMap.entries()]
      .map(([year, values]) => ({
        year,
        changePct: values.reduce((sum: number, value: number) => sum + value, 0) / values.length,
      }))
      .sort((a, b) => a.year - b.year);

    const regByYear = new Map(regYoY.map((point) => [point.year, point.changePct]));
    const ssbByYear = new Map(ssbYoY.map((point) => [point.year, point.changePct]));
    const sharedYears = [...regByYear.keys()].filter((year) => ssbByYear.has(year)).sort();

    const regValues = sharedYears.map((year) => regByYear.get(year)!);
    const ssbValues = sharedYears.map((year) => ssbByYear.get(year)!);

    return {
      driver,
      label: TMF_DRIVER_LABELS[driver],
      correlation: pearsonCorrelation(regValues, ssbValues),
      observations: sharedYears.length,
      registrationYoY: regYoY,
      ssbYoY,
    };
  });
}

export function runTmfBacktest(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  ssbPoints: SsbIndicatorPoint[],
  reference = new Date(),
  driverConfig?: TmfDriverConfig,
  weights: { trendWeight: number; shareTrendWeight: number } = {
    trendWeight: 0,
    shareTrendWeight: 0,
  },
): TmfBacktestResult {
  const { trendWeight, shareTrendWeight } = weights;
  const { min: minDataYear } = getDataYearRange(rows);
  const firstBacktestYear = firstAsOfBacktestYear(minDataYear);
  const lastBacktestYear = lastAsOfBacktestYear(reference);
  const asOfMonth = reference.getMonth() + 1;
  const asOfLabel = MONTH_NAMES[asOfMonth - 1] ?? String(asOfMonth);

  const notes = [
    `Backtest simulerer prognosen slik den faktisk lages: kjørt i ${asOfLabel} året før målåret, kun med data til og med foregående måned.`,
    "OFV-kjerne = baseline (rullerende 12 mnd) × sesong. Full modell legger på SSB. Levert modell legger på trend/YTD-momentum.",
    "Levert modell kjører med samme vekter som den levende prognosen, og setter P10/P90.",
    "Volvo-volum måles ved siden av markedet: det bærer både markedsfeilen og feilen i andelen.",
    "Ordreinngang og tilbudsaktivitet inngår ikke i backtesten — de er manuelle YoY-prosenter uten historisk serie.",
    "SSB-drivere bruker dagens indikatorverdier — ikke ekte historiske øyeblikksbilder. Full modell er derfor litt for flatterende.",
    `Historikk fra ${minDataYear}: første målår er ${firstBacktestYear} fordi baseline for målår Y starter i Y−2.`,
  ];

  if (firstBacktestYear > lastBacktestYear) {
    return {
      models: [],
      driverCorrelations: [],
      firstBacktestYear,
      lastBacktestYear,
      asOfMonth,
      shippedModelId: "full_trend",
      notes: [...notes, "Utilstrekkelig historikk for årlig backtest."],
    };
  }

  const weightLabel = driverConfig ? `vekt ${driverConfig.signalWeight}` : "standardvekt";
  const macroLabel = driverConfig ? `, makro ${driverConfig.macroWeight}` : "";

  const models = [
    runModelBacktest(
      rows,
      driverGroups,
      firstBacktestYear,
      lastBacktestYear,
      "core",
      "OFV-kjerne",
      "Baseline × sesong (uten SSB og trend)",
      { trendWeight: 0, shareTrendWeight: 0, useDrivers: false, asOfMonth },
    ),
    runModelBacktest(
      rows,
      driverGroups,
      firstBacktestYear,
      lastBacktestYear,
      "full",
      "Med SSB",
      `Baseline × sesong × SSB (${weightLabel}${macroLabel})`,
      { trendWeight: 0, shareTrendWeight: 0, useDrivers: true, asOfMonth, driverConfig },
    ),
    runModelBacktest(
      rows,
      driverGroups,
      firstBacktestYear,
      lastBacktestYear,
      "full_trend",
      "Levert modell",
      [
        trendWeight > 0
          ? `Baseline × trend/YTD (vekt ${trendWeight}) × sesong × SSB (${weightLabel}${macroLabel})`
          : `Baseline × sesong × SSB (${weightLabel}${macroLabel}) — trend kalibrert til 0`,
        shareTrendWeight > 0
          ? `Volvo-andel med YTD-momentum (vekt ${shareTrendWeight})`
          : "Volvo-andel = rullerende 12 mnd",
      ].join(". "),
      { trendWeight, shareTrendWeight, useDrivers: true, asOfMonth, driverConfig },
    ),
  ];

  const driverCorrelations = analyzeDriverCorrelations(rows, ssbPoints);

  return {
    models,
    driverCorrelations,
    firstBacktestYear,
    lastBacktestYear,
    asOfMonth,
    shippedModelId: "full_trend",
    notes,
  };
}
