import type { PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfDriver } from "@/lib/ssb/types";
import type { SsbDriverGroup } from "@/lib/ssb/queries";

/** Kobler OFV påbygg-segment til TMF-driver (SSB). */
export const PABYGG_TO_TMF_DRIVER: Record<PabyggSegment, TmfDriver> = {
  Construction: "construction",
  Distribution: "distribution",
  "Long Haul": "long_haul",
  Annet: "macro",
};

export interface TmfDriverConfig {
  signalWeight: number;
  indexMin: number;
  indexMax: number;
  /**
   * Vekt på makroindeksen som legges over alle segmentdrivere (0–1).
   * Rente og BNP treffer flåtefornyelse i alle segmenter, ikke bare «Annet».
   */
  macroWeight: number;
}

export const DEFAULT_DRIVER_CONFIG: TmfDriverConfig = {
  signalWeight: 0.4,
  indexMin: 0.88,
  indexMax: 1.12,
  macroWeight: 0.3,
};

export function driverConfigFromCalibration(calibration: {
  signalWeight: number;
  indexMin: number;
  indexMax: number;
  macroWeight?: number;
}): TmfDriverConfig {
  return {
    signalWeight: calibration.signalWeight,
    indexMin: calibration.indexMin,
    indexMax: calibration.indexMax,
    macroWeight: calibration.macroWeight ?? DEFAULT_DRIVER_CONFIG.macroWeight,
  };
}

export interface TmfDriverIndexInfo {
  driver: TmfDriver;
  index: number;
  avgChangePct: number | null;
  indicatorCount: number;
}

function clampIndex(value: number, config: TmfDriverConfig): number {
  return Math.max(config.indexMin, Math.min(config.indexMax, value));
}

/** Beregn driverindeks per TMF-segment fra SSB YoY-endring. */
export function computeDriverIndices(
  groups: SsbDriverGroup[],
  config: TmfDriverConfig = DEFAULT_DRIVER_CONFIG,
): Record<TmfDriver, TmfDriverIndexInfo> {
  const defaults: Record<TmfDriver, TmfDriverIndexInfo> = {
    construction: { driver: "construction", index: 1, avgChangePct: null, indicatorCount: 0 },
    distribution: { driver: "distribution", index: 1, avgChangePct: null, indicatorCount: 0 },
    long_haul: { driver: "long_haul", index: 1, avgChangePct: null, indicatorCount: 0 },
    macro: { driver: "macro", index: 1, avgChangePct: null, indicatorCount: 0 },
  };

  for (const group of groups) {
    const changes = group.indicators
      .map((indicator) => indicator.changePct)
      .filter((value): value is number => value != null);

    if (changes.length === 0) continue;

    const avgChangePct = changes.reduce((sum, value) => sum + value, 0) / changes.length;
    const dampedPct = avgChangePct * config.signalWeight;
    const index = clampIndex(1 + dampedPct / 100, config);

    defaults[group.driver] = {
      driver: group.driver,
      index,
      avgChangePct,
      indicatorCount: changes.length,
    };
  }

  return defaults;
}

/**
 * Effektiv driverindeks for et segment: segmentets egen SSB-indeks blandet
 * geometrisk med makroindeksen. `Annet` bruker makro direkte og blandes ikke
 * (ellers dobbeltvektes den).
 *
 * Nøytral makro (indeks 1) demper segmentsignalet mot 1 med `macroWeight` —
 * det er tilsiktet: makrodelen av signalet sier da ingenting.
 */
export function getDriverIndexForPabygg(
  pabygg: PabyggSegment | string,
  indices: Record<TmfDriver, TmfDriverIndexInfo>,
  config: TmfDriverConfig = DEFAULT_DRIVER_CONFIG,
): number {
  const driver = PABYGG_TO_TMF_DRIVER[pabygg as PabyggSegment] ?? "macro";
  const segmentIndex = indices[driver]?.index ?? 1;

  if (driver === "macro" || config.macroWeight <= 0) return segmentIndex;

  const macroIndex = indices.macro?.index ?? 1;
  if (segmentIndex <= 0 || macroIndex <= 0) return segmentIndex;

  const blended =
    Math.pow(segmentIndex, 1 - config.macroWeight) * Math.pow(macroIndex, config.macroWeight);
  return clampIndex(blended, config);
}
