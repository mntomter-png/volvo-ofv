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
    /**
     * Anslag for hvor året lander: faktisk t.o.m. siste fullførte måned,
     * prognose for resten. Dette er tallet neste år skal sammenlignes mot —
     * ren årsprognose er identisk med neste år når trendvekten er 0.
     */
    annualLandingEstimate: number;
    /** Antall måneder med faktiske tall i landingsanslaget. */
    landingActualMonths: number;
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
  /** Effektiv Volvo-andel brukt i estimatet (%). */
  volvoSharePct: number;
  volvoShareOverridden: boolean;
  /** Rullerende 12 mnd Volvo-andel (%) før YTD-blend. */
  volvoShareTrailingPct: number;
  /** Volvo-andel YTD i år (%), null hvis for få måneder. */
  volvoShareYtdPct: number | null;
  volvoShareYtdWeight: number;
  volvoShareMonthsUsed: number;
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
  /** Kalibrert andel av trend/YTD-utslaget som er brukt (0–1). */
  trendWeight: number;
}

export interface TmfConfidencePoint {
  p10: number;
  p50: number;
  p90: number;
}

export interface TmfConfidenceSegment {
  pabygg: string;
  label: string;
  market: TmfConfidencePoint;
  volvo: TmfConfidencePoint;
  downsidePct: number;
  upsidePct: number;
  mapePct: number;
  /** Antall backtest-observasjoner bak segmentets bånd. */
  observations: number;
}

export interface TmfConfidenceBands {
  market: TmfConfidencePoint;
  volvo: TmfConfidencePoint;
  mapeUsed: number;
  /** Nedsidebredde i % — snitt av årene der prognosen var for høy. */
  downsidePct: number;
  /** Oppsidebredde i % — snitt av årene der prognosen var for lav. */
  upsidePct: number;
  /** Hvilken backtest-modell båndet er hentet fra. */
  modelLabel: string;
  scenarioLow: number;
  scenarioHigh: number;
  segments: TmfConfidenceSegment[];
  method: string;
}

export interface TmfCalibrationInfo {
  signalWeight: number;
  /** Vekt på makroindeksen over alle segmenter. */
  macroWeight: number;
  /** Andel av trend/YTD-utslaget som slippes gjennom (0–1), kalibrert mot MAPE. */
  trendWeight: number;
  indexMin: number;
  indexMax: number;
  mapeAtWeight: number;
  noSsbMape: number;
  beatsNoSsb: boolean;
  note: string;
  candidates: { signalWeight: number; macroWeight: number; mape: number }[];
  trendCandidates: { trendWeight: number; mape: number }[];
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

export type TmfBacktestModelId = "core" | "full" | "full_trend";

export interface TmfBacktestSegmentAccuracy {
  label: string;
  mape: number;
  observations: number;
  /** Snitt av årene prognosen var for høy (%). */
  downsidePct: number;
  /** Snitt av årene prognosen var for lav (%). */
  upsidePct: number;
}

export interface TmfBacktestModelResult {
  modelId: TmfBacktestModelId;
  modelLabel: string;
  description: string;
  years: TmfBacktestYearResult[];
  mapeTotal: number;
  biasPct: number;
  /** Snitt av årene prognosen var for høy (%) — nedsiderisiko. */
  downsidePct: number;
  /** Snitt av årene prognosen var for lav (%) — oppsiderisiko. */
  upsidePct: number;
  mapeBySegment: Record<string, TmfBacktestSegmentAccuracy>;
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
  /** Måneden prognosene er simulert fra (samme måned som den levende kjøringen). */
  asOfMonth: number;
  /** Modellen som leveres, og som setter usikkerhetsbåndet. */
  shippedModelId: TmfBacktestModelId;
  notes: string[];
}
