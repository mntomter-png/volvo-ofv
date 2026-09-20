/**
 * Fornyelsespulje fra OFV-populasjon / PKK.
 *
 * PKK innen 12 måneder er nesten hele bestanden (årlig kontroll) og sier lite
 * om erstatning. Her bruker vi alder (≥10 år) som hovedsignal, med forfalt
 * PKK som mild boost. Uten historiske populasjonssnapshots kan vi ikke vite om
 * totalmarkedet er «høyt» eller «lavt» — bare hvor trykket sitter relativt
 * mellom segmentene. Derfor normaliseres dekningen mot markedets egen snitt-
 * dekning, slik at totalen holder seg nøktern mens fordelingen flyttes.
 */

import { getPabyggSegmentLabel } from "@/lib/ofv/segmentation";

/** Andel av relativt trykk som slippes gjennom i markedsprognosen. */
export const RENEWAL_PASS_THROUGH = 0.25;
/** Forfalt PKK teller delvis — frist er ikke kjøp, men øker sannsynlighet. */
export const RENEWAL_OVERDUE_WEIGHT = 0.35;
/** Maks samlet utslag per segment. */
export const MAX_RENEWAL_EFFECT_PCT = 8;

export interface TmfRenewalPoolRow {
  pabygg: string;
  stockCount: number;
  oldCount: number;
  overdueCount: number;
  due90Count: number;
  focusOldCount: number;
}

export interface TmfRenewalSegmentSignal {
  pabygg: string;
  label: string;
  stockCount: number;
  oldCount: number;
  overdueCount: number;
  due90Count: number;
  focusOldCount: number;
  /** Effektiv pulje etter vekt på forfalt PKK. */
  poolCount: number;
  /** Trailing 12 mnd OFV-registreringer i segmentet. */
  trailing12Count: number;
  /** År med trailing-volum puljen «dekker» (pulje / trailing). */
  coverYears: number;
  /** Markedets snitt-dekning, brukt som nøytral referanse. */
  marketCoverYears: number;
  /** Rå (cover / marketCover − 1) i prosent, før demping. */
  pressurePct: number;
  effectPct: number;
  multiplier: number;
  clamped: boolean;
}

export interface TmfRenewalSignal {
  /** Multiplikator per påbygg (1 = nøytral). */
  byPabygg: Record<string, TmfRenewalSegmentSignal>;
  segments: TmfRenewalSegmentSignal[];
  /**
   * Volumvektet effekt på totalmarkedet, etter demping.
   * Skal ligge nær 0 når signalet bare omfordeler mellom segmenter.
   */
  effectPct: number;
  multiplier: number;
  clamped: boolean;
  oldYears: number;
  marketCoverYears: number;
}

export const NEUTRAL_RENEWAL_SIGNAL: TmfRenewalSignal = {
  byPabygg: {},
  segments: [],
  effectPct: 0,
  multiplier: 1,
  clamped: false,
  oldYears: 10,
  marketCoverYears: 0,
};

function clampEffect(raw: number): { effectPct: number; clamped: boolean } {
  const effectPct = Math.max(
    -MAX_RENEWAL_EFFECT_PCT,
    Math.min(MAX_RENEWAL_EFFECT_PCT, raw),
  );
  return {
    effectPct,
    clamped: Math.abs(raw - effectPct) > 0.001,
  };
}

function poolCount(row: TmfRenewalPoolRow): number {
  return row.oldCount + RENEWAL_OVERDUE_WEIGHT * row.overdueCount;
}

/**
 * Bygger markeds-multiplikatorer fra fornyelsespulje vs. trailing registreringer.
 *
 * Dekning = pulje / trailing12. Segmenter med høyere dekning enn markedssnittet
 * løftes forsiktig; de med lavere dempes. Uten historikk er dette en
 * omfordeling, ikke et absolutt nivåsignal.
 */
export function buildRenewalSignal(
  pool: TmfRenewalPoolRow[],
  trailingByPabygg: Record<string, number>,
  options?: { oldYears?: number },
): TmfRenewalSignal {
  if (pool.length === 0) {
    return {
      ...NEUTRAL_RENEWAL_SIGNAL,
      oldYears: options?.oldYears ?? 10,
    };
  }

  let totalPool = 0;
  let totalTrailing = 0;
  for (const row of pool) {
    const trailing = Math.max(0, trailingByPabygg[row.pabygg] ?? 0);
    totalPool += poolCount(row);
    totalTrailing += trailing;
  }

  const marketCoverYears = totalTrailing > 0 ? totalPool / totalTrailing : 0;
  if (marketCoverYears <= 0) {
    return {
      ...NEUTRAL_RENEWAL_SIGNAL,
      oldYears: options?.oldYears ?? 10,
    };
  }

  const segments: TmfRenewalSegmentSignal[] = [];
  const byPabygg: Record<string, TmfRenewalSegmentSignal> = {};
  let weightedEffect = 0;
  let weightSum = 0;
  let anyClamped = false;

  for (const row of pool) {
    const trailing12Count = Math.max(0, trailingByPabygg[row.pabygg] ?? 0);
    const pool = poolCount(row);
    const coverYears = trailing12Count > 0 ? pool / trailing12Count : 0;
    const pressurePct =
      trailing12Count > 0 && pool > 0
        ? (coverYears / marketCoverYears - 1) * 100
        : 0;
    const rawEffect = pressurePct * RENEWAL_PASS_THROUGH;
    const { effectPct, clamped } = clampEffect(rawEffect);
    anyClamped = anyClamped || clamped;

    const signal: TmfRenewalSegmentSignal = {
      pabygg: row.pabygg,
      label: getPabyggSegmentLabel(row.pabygg),
      stockCount: row.stockCount,
      oldCount: row.oldCount,
      overdueCount: row.overdueCount,
      due90Count: row.due90Count,
      focusOldCount: row.focusOldCount,
      poolCount: pool,
      trailing12Count,
      coverYears,
      marketCoverYears,
      pressurePct,
      effectPct,
      multiplier: 1 + effectPct / 100,
      clamped,
    };

    segments.push(signal);
    byPabygg[row.pabygg] = signal;

    if (trailing12Count > 0) {
      weightedEffect += effectPct * trailing12Count;
      weightSum += trailing12Count;
    }
  }

  segments.sort((a, b) => a.label.localeCompare(b.label, "nb"));

  const effectPct = weightSum > 0 ? weightedEffect / weightSum : 0;

  return {
    byPabygg,
    segments,
    effectPct,
    multiplier: 1 + effectPct / 100,
    clamped: anyClamped,
    oldYears: options?.oldYears ?? 10,
    marketCoverYears,
  };
}

export function renewalMultiplierForPabygg(
  signal: TmfRenewalSignal,
  pabygg: string,
): number {
  return signal.byPabygg[pabygg]?.multiplier ?? 1;
}
