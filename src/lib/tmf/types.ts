import type { PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfDriver } from "@/lib/ssb/types";
import type { TmfScenarioId } from "@/lib/tmf/scenarios";
import type { TmfSegmentAdjustments, TmfVolvoShareOverrides } from "@/lib/tmf/adjustments";

export interface TmfMonthlyMarketRow {
  month: string;
  pabygg: PabyggSegment | string;
  count: number;
  volvo_count: number;
  emob_count: number;
}

export interface TmfSeasonalFactor {
  month: number;
  factor: number;
}

export interface TmfSegmentBaseline {
  pabygg: PabyggSegment | string;
  monthlyAverage: number;
  trailing12Total: number;
  volvoTrailing12Total: number;
  volvoSharePct: number;
  emobTrailing12Total: number;
  emobSharePct: number;
}

export interface TmfMonthlyPoint {
  month: number;
  monthLabel: string;
  actual: number | null;
  forecast: number;
  adjustedForecast: number;
}

export interface TmfSegmentForecast {
  pabygg: PabyggSegment | string;
  label: string;
  tmfDriver: TmfDriver;
  driverMultiplier: number;
  analystAdjustmentPct: number;
  baseline: TmfSegmentBaseline;
  seasonalFactors: TmfSeasonalFactor[];
  monthly: TmfMonthlyPoint[];
  ytdActual: number;
  ytdForecast: number;
  ytdAdjustedForecast: number;
  annualForecast: number;
  annualAdjustedForecast: number;
}

export interface TmfForecastResult {
  year: number;
  generatedAt: string;
  seasonalityYears: number[];
  scenario: TmfScenarioId;
  scenarioLabel: string;
  segments: TmfSegmentForecast[];
  total: {
    monthly: TmfMonthlyPoint[];
    ytdActual: number;
    ytdForecast: number;
    ytdAdjustedForecast: number;
    annualForecast: number;
    annualAdjustedForecast: number;
    /** Faktiske registreringer per måned for året før (Jan–Des). */
    priorYearMonthlyActual: (number | null)[];
  };
}

export interface TmfSegmentTrendInfo {
  /** Effektiv blended trend (%) brukt i prognosen. */
  cagrPct: number;
  /** Historisk CAGR over fullførte år (%). */
  historicalCagrPct: number;
  /** YTD YoY vs. samme periode i fjor (%), null hvis ikke brukt. */
  ytdMomentumPct: number | null;
  /** Vekt på YTD i blend (0–1). */
  ytdWeight: number;
  ytdMonthsUsed: number;
  nextYearMultiplier: number;
  yearsUsed: number[];
}

export interface TmfYearEstimateSegment {
  pabygg: PabyggSegment | string;
  label: string;
  tmfDriver: TmfDriver;
  driverMultiplier: number;
  analystAdjustmentPct: number;
  monthly: TmfMonthlyPoint[];
  annualMarket: number;
  annualVolvo: number;
  volvoSharePct: number;
  volvoShareOverridden: boolean;
  /** EMOB-andel fra trailing 12 mnd (mekanisk split). */
  emobSharePct: number;
  annualEmob: number;
  annualIce: number;
  trend: TmfSegmentTrendInfo;
}

export interface TmfYearEstimate {
  year: number;
  segments: TmfYearEstimateSegment[];
  total: {
    monthly: TmfMonthlyPoint[];
    annualMarket: number;
    annualVolvo: number;
    volvoSharePct: number;
    annualEmob: number;
    annualIce: number;
    emobSharePct: number;
  };
  trendApplied: boolean;
}

export interface TmfConfidencePoint {
  p10: number;
  p50: number;
  p90: number;
}

export interface TmfConfidenceBands {
  market: TmfConfidencePoint;
  volvo: TmfConfidencePoint;
  mapeUsed: number;
  scenarioLow: number;
  scenarioHigh: number;
  method: string;
}

export interface TmfCalibrationInfo {
  signalWeight: number;
  indexMin: number;
  indexMax: number;
  mapeAtWeight: number;
  coreMape: number;
  beatsCore: boolean;
  note: string;
  candidates: { signalWeight: number; mape: number }[];
}

export type TmfCalibrationResult = TmfCalibrationInfo;

export interface TmfEstimateResult {
  scenario: TmfScenarioId;
  scenarioLabel: string;
  segmentAdjustments: TmfSegmentAdjustments;
  volvoShareOverrides: TmfVolvoShareOverrides;
  currentYear: TmfForecastResult;
  nextYear: TmfYearEstimate;
  confidence: TmfConfidenceBands;
  calibration: TmfCalibrationInfo;
  scenarioEnvelope: {
    optimisticMarket: number;
    conservativeMarket: number;
    optimisticVolvo: number;
    conservativeVolvo: number;
  };
  driverIndices: Record<
    TmfDriver,
    { index: number; avgChangePct: number | null; indicatorCount: number }
  >;
}

export interface TmfBacktestSegmentResult {
  pabygg: string;
  label: string;
  forecast: number;
  actual: number;
  errorPct: number;
  absErrorPct: number;
}

export interface TmfBacktestYearResult {
  year: number;
  forecastTotal: number;
  actualTotal: number;
  errorPct: number;
  absErrorPct: number;
  segments: TmfBacktestSegmentResult[];
}

export interface TmfBacktestModelResult {
  modelId: "core" | "full";
  modelLabel: string;
  description: string;
  years: TmfBacktestYearResult[];
  mapeTotal: number;
  biasPct: number;
  mapeBySegment: Record<string, { label: string; mape: number; observations: number }>;
}

export interface TmfDriverCorrelation {
  driver: TmfDriver;
  label: string;
  correlation: number | null;
  observations: number;
  registrationYoY: { year: number; changePct: number }[];
  ssbYoY: { year: number; changePct: number }[];
}

export interface TmfBacktestResult {
  models: TmfBacktestModelResult[];
  driverCorrelations: TmfDriverCorrelation[];
  firstBacktestYear: number;
  lastBacktestYear: number;
  notes: string[];
}
