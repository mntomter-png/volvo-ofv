import type { PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfDriver } from "@/lib/ssb/types";
import type { TmfScenarioId } from "@/lib/tmf/scenarios";
import type { TmfSegmentAdjustments, TmfVolvoShareOverrides } from "@/lib/tmf/adjustments";

export interface TmfMonthlyMarketRow {
  month: string;
  pabygg: PabyggSegment | string;
  count: number;
  volvo_count: number;
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
  };
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
}

export interface TmfYearEstimate {
  year: number;
  segments: TmfYearEstimateSegment[];
  total: {
    monthly: TmfMonthlyPoint[];
    annualMarket: number;
    annualVolvo: number;
    volvoSharePct: number;
  };
}

export interface TmfEstimateResult {
  scenario: TmfScenarioId;
  scenarioLabel: string;
  segmentAdjustments: TmfSegmentAdjustments;
  volvoShareOverrides: TmfVolvoShareOverrides;
  currentYear: TmfForecastResult;
  nextYear: TmfYearEstimate;
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
