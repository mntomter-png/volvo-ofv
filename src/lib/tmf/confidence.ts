import type {
  TmfBacktestModelResult,
  TmfBacktestResult,
  TmfConfidenceBands,
  TmfConfidenceSegment,
  TmfYearEstimate,
} from "@/lib/tmf/types";

const DEFAULT_MAPE_FALLBACK = 12;
/** Minste halvbredde — et bånd smalere enn dette er ikke troverdig. */
const MIN_HALF_WIDTH_PCT = 5;

export interface TmfScenarioRange {
  low: number;
  high: number;
  volvoLow: number;
  volvoHigh: number;
}

export interface TmfScenarioEnvelopeInput extends TmfScenarioRange {
  segments: Record<string, TmfScenarioRange>;
}

function asymmetricBand(
  point: number,
  downsidePct: number,
  upsidePct: number,
): { p10: number; p50: number; p90: number } {
  const down = Math.max(downsidePct, MIN_HALF_WIDTH_PCT) / 100;
  const up = Math.max(upsidePct, MIN_HALF_WIDTH_PCT) / 100;
  return {
    p10: point * (1 - down),
    p50: point,
    p90: point * (1 + up),
  };
}

function unionWithScenario(
  band: { p10: number; p50: number; p90: number },
  low: number,
  high: number,
): { p10: number; p50: number; p90: number } {
  return {
    p10: Math.min(band.p10, low),
    p50: band.p50,
    p90: Math.max(band.p90, high),
  };
}

function buildSegmentBands(
  nextYear: TmfYearEstimate,
  model: TmfBacktestModelResult | null,
  envelope: TmfScenarioEnvelopeInput,
  fallbackDown: number,
  fallbackUp: number,
  fallbackMape: number,
): TmfConfidenceSegment[] {
  return nextYear.segments.map((segment) => {
    const key = String(segment.pabygg);
    const accuracy = model?.mapeBySegment[key];
    const downsidePct = accuracy?.downsidePct ?? fallbackDown;
    const upsidePct = accuracy?.upsidePct ?? fallbackUp;
    const range = envelope.segments[key];

    const market = asymmetricBand(segment.annualMarket, downsidePct, upsidePct);
    const volvo = asymmetricBand(segment.annualVolvo, downsidePct, upsidePct);

    return {
      pabygg: key,
      label: segment.label,
      market: range ? unionWithScenario(market, range.low, range.high) : market,
      volvo: range ? unionWithScenario(volvo, range.volvoLow, range.volvoHigh) : volvo,
      downsidePct,
      upsidePct,
      mapePct: accuracy?.mape ?? fallbackMape,
      observations: accuracy?.observations ?? 0,
    };
  });
}

/**
 * Bygger P10/P50/P90 for neste års marked og Volvo-estimat.
 *
 * Båndet er asymmetrisk fordi den historiske feilen er det: årene vi traff for
 * høyt har bommet mer enn årene vi traff for lavt. Bredden hentes fra den
 * modellen som faktisk leveres (trend/YTD + SSB), ikke fra en enklere variant.
 */
export function buildConfidenceBands(
  nextYear: TmfYearEstimate,
  scenarioEnvelope: TmfScenarioEnvelopeInput,
  backtest: TmfBacktestResult | null,
): TmfConfidenceBands {
  const shippedModel =
    backtest?.models.find((model) => model.modelId === backtest.shippedModelId) ??
    backtest?.models.find((model) => model.modelId === "core") ??
    null;

  const mapeUsed = shippedModel?.mapeTotal ?? DEFAULT_MAPE_FALLBACK;
  const downsidePct = shippedModel?.downsidePct ?? mapeUsed;
  const upsidePct = shippedModel?.upsidePct ?? mapeUsed;

  const market = unionWithScenario(
    asymmetricBand(nextYear.total.annualMarket, downsidePct, upsidePct),
    scenarioEnvelope.low,
    scenarioEnvelope.high,
  );

  const volvo = unionWithScenario(
    asymmetricBand(nextYear.total.annualVolvo, downsidePct, upsidePct),
    scenarioEnvelope.volvoLow,
    scenarioEnvelope.volvoHigh,
  );

  return {
    market,
    volvo,
    mapeUsed,
    downsidePct,
    upsidePct,
    modelLabel: shippedModel?.modelLabel ?? "Ingen backtest",
    scenarioLow: scenarioEnvelope.low,
    scenarioHigh: scenarioEnvelope.high,
    segments: buildSegmentBands(
      nextYear,
      shippedModel,
      scenarioEnvelope,
      downsidePct,
      upsidePct,
      mapeUsed,
    ),
    method: `P50 = valgt scenario. P10 = −${Math.max(downsidePct, MIN_HALF_WIDTH_PCT).toFixed(1)} %, P90 = +${Math.max(upsidePct, MIN_HALF_WIDTH_PCT).toFixed(1)} % fra historisk feil i «${shippedModel?.modelLabel ?? "ukjent"}», utvidet med scenariospennet.`,
  };
}
