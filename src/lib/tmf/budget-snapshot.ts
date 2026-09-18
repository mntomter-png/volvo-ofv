import type { TmfEstimateResult } from "@/lib/tmf/types";

/**
 * Fryste tall fra en budsjettversjon.
 *
 * Konfigurasjonen alene er ikke nok til å gjenskape hva vi sa: OFV-historikken
 * vokser, SSB reviderer, og kalibreringen velger nye vekter for hver kjøring.
 * Snapshotet tar derfor vare på både resultatet og parametrene som ga det, så
 * et avvik mot dagens tall kan forklares.
 */
export interface TmfBudgetSnapshot {
  /** Skjemaversjon, slik at gamle snapshots kan leses etter endringer. */
  version: 1;
  frozenAt: string;
  targetYear: number;
  /** Siste måned med faktiske OFV-tall da versjonen ble lagret (YYYY-MM). */
  dataThroughMonth: string | null;
  model: {
    trendWeight: number;
    shareTrendWeight: number;
    signalWeight: number;
    macroWeight: number;
    mapeUsed: number;
    downsidePct: number;
    upsidePct: number;
    commercialEffectPct: number;
  };
  total: {
    market: number;
    marketP10: number;
    marketP90: number;
    volvo: number;
    volvoSharePct: number;
    emob: number;
    ice: number;
  };
  /** Hvor inneværende år var ventet å lande da versjonen ble lagret. */
  currentYear: {
    year: number;
    landingEstimate: number;
    actualMonths: number;
  };
  segments: TmfBudgetSnapshotSegment[];
}

export interface TmfBudgetSnapshotSegment {
  pabygg: string;
  label: string;
  market: number;
  volvo: number;
  volvoSharePct: number;
}

export function buildTmfBudgetSnapshot(estimate: TmfEstimateResult): TmfBudgetSnapshot {
  const { nextYear, currentYear, confidence, calibration } = estimate;

  // Landingsanslaget teller måneder med faktiske tall, så det peker på samme
  // datagrunnlag modellen faktisk brukte.
  const actualMonths = currentYear.total.landingActualMonths;
  const dataThroughMonth =
    actualMonths > 0
      ? `${currentYear.year}-${String(actualMonths).padStart(2, "0")}`
      : null;

  return {
    version: 1,
    frozenAt: new Date().toISOString(),
    targetYear: nextYear.year,
    dataThroughMonth,
    model: {
      trendWeight: nextYear.trendWeight,
      shareTrendWeight: nextYear.shareTrendWeight,
      signalWeight: calibration.signalWeight,
      macroWeight: calibration.macroWeight,
      mapeUsed: confidence.mapeUsed,
      downsidePct: confidence.downsidePct,
      upsidePct: confidence.upsidePct,
      commercialEffectPct: nextYear.commercialSignal.effectPct,
    },
    total: {
      market: nextYear.total.annualMarket,
      marketP10: confidence.market.p10,
      marketP90: confidence.market.p90,
      volvo: nextYear.total.annualVolvo,
      volvoSharePct: nextYear.total.volvoSharePct,
      emob: nextYear.total.annualEmob,
      ice: nextYear.total.annualIce,
    },
    currentYear: {
      year: currentYear.year,
      landingEstimate: currentYear.total.annualLandingEstimate,
      actualMonths,
    },
    segments: nextYear.segments.map((segment) => ({
      pabygg: String(segment.pabygg),
      label: segment.label,
      market: segment.annualMarket,
      volvo: segment.annualVolvo,
      volvoSharePct: segment.volvoSharePct,
    })),
  };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Leser et lagret snapshot. Returnerer null for versjoner lagret uten fryste tall. */
export function normalizeTmfBudgetSnapshot(raw: unknown): TmfBudgetSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const root = raw as Record<string, unknown>;
  const total = record(root.total);
  const model = record(root.model);
  const currentYear = record(root.currentYear);

  // Uten et markedstall er snapshotet ubrukelig til sammenligning.
  if (!Number.isFinite(total.market as number)) return null;

  const segments = Array.isArray(root.segments) ? root.segments : [];

  return {
    version: 1,
    frozenAt: typeof root.frozenAt === "string" ? root.frozenAt : "",
    targetYear: num(root.targetYear),
    dataThroughMonth:
      typeof root.dataThroughMonth === "string" ? root.dataThroughMonth : null,
    model: {
      trendWeight: num(model.trendWeight),
      shareTrendWeight: num(model.shareTrendWeight),
      signalWeight: num(model.signalWeight),
      macroWeight: num(model.macroWeight),
      mapeUsed: num(model.mapeUsed),
      downsidePct: num(model.downsidePct),
      upsidePct: num(model.upsidePct),
      commercialEffectPct: num(model.commercialEffectPct),
    },
    total: {
      market: num(total.market),
      marketP10: num(total.marketP10),
      marketP90: num(total.marketP90),
      volvo: num(total.volvo),
      volvoSharePct: num(total.volvoSharePct),
      emob: num(total.emob),
      ice: num(total.ice),
    },
    currentYear: {
      year: num(currentYear.year),
      landingEstimate: num(currentYear.landingEstimate),
      actualMonths: num(currentYear.actualMonths),
    },
    segments: segments.map((entry) => {
      const segment = record(entry);
      return {
        pabygg: typeof segment.pabygg === "string" ? segment.pabygg : "",
        label: typeof segment.label === "string" ? segment.label : "",
        market: num(segment.market),
        volvo: num(segment.volvo),
        volvoSharePct: num(segment.volvoSharePct),
      };
    }),
  };
}
