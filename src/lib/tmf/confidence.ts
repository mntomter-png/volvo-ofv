import type { TmfBacktestResult, TmfConfidenceBands, TmfYearEstimate } from "@/lib/tmf/types";

const DEFAULT_MAPE_FALLBACK = 12;

function bandFromPoint(point: number, mapePct: number): { p10: number; p50: number; p90: number } {
  const half = Math.max(mapePct, 5) / 100;
  return {
    p10: point * (1 - half),
    p50: point,
    p90: point * (1 + half),
  };
}

/**
 * Bygger P10/P50/P90 for neste års marked og Volvo-estimat.
 * Bredden styres primært av historisk OFV-kjerne-MAPE, utvidet med scenariospenn.
 */
export function buildConfidenceBands(
  nextYear: TmfYearEstimate,
  scenarioEnvelope: { low: number; high: number; volvoLow: number; volvoHigh: number },
  backtest: TmfBacktestResult | null,
): TmfConfidenceBands {
  const coreModel = backtest?.models.find((model) => model.modelId === "core");
  const mapeUsed = coreModel?.mapeTotal ?? DEFAULT_MAPE_FALLBACK;

  const marketFromMape = bandFromPoint(nextYear.total.annualMarket, mapeUsed);
  const volvoFromMape = bandFromPoint(nextYear.total.annualVolvo, mapeUsed);

  const market = {
    p10: Math.min(marketFromMape.p10, scenarioEnvelope.low),
    p50: marketFromMape.p50,
    p90: Math.max(marketFromMape.p90, scenarioEnvelope.high),
  };

  const volvo = {
    p10: Math.min(volvoFromMape.p10, scenarioEnvelope.volvoLow),
    p50: volvoFromMape.p50,
    p90: Math.max(volvoFromMape.p90, scenarioEnvelope.volvoHigh),
  };

  return {
    market,
    volvo,
    mapeUsed,
    scenarioLow: scenarioEnvelope.low,
    scenarioHigh: scenarioEnvelope.high,
    method:
      "P50 = valgt scenario. P10/P90 = max(MAPE-bånd fra OFV-kjerne, scenariospenn basis/opt/kons).",
  };
}
