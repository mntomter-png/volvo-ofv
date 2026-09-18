import {
  buildTmfPageSearchParams,
  describeTmfBudgetConfig,
  type TmfBudgetConfig,
} from "@/lib/tmf/adjustments";
import type { TmfBudgetSnapshot } from "@/lib/tmf/budget-snapshot";
import type { TmfCommercialIndicator } from "@/lib/tmf/commercial";
import { buildTmfEstimate } from "@/lib/tmf/model";
import type {
  TmfBacktestResult,
  TmfCalibrationInfo,
  TmfEstimateResult,
  TmfForecastResult,
  TmfMonthlyMarketRow,
} from "@/lib/tmf/types";

export interface TmfVersionSegmentTotals {
  pabygg: string;
  label: string;
  market: number;
  volvo: number;
}

/** Tallene en versjon kan måles på, uansett om de er fryste eller live. */
export interface TmfVersionTotals {
  market: number;
  volvo: number;
  segments: TmfVersionSegmentTotals[];
}

export interface TmfVersionActual {
  market: number;
  volvo: number;
  /** Antall måneder med registreringer i målåret. */
  months: number;
  complete: boolean;
}

/** Modellparametrene som avgjør nivået, brukt til å forklare drift. */
export interface TmfVersionModelParams {
  trendWeight: number;
  signalWeight: number;
  macroWeight: number;
}

export interface TmfVersionTrackingRow {
  id: string;
  name: string;
  description: string | null;
  targetYear: number;
  createdAt: string;
  config: TmfBudgetConfig;
  configLabel: string;
  /** Lenke som gjenskaper forutsetningene i UI-et. */
  configHref: string;
  /** Tallene slik de var da versjonen ble lagret. Null for gamle versjoner. */
  snapshot: TmfBudgetSnapshot | null;
  /** Samme forutsetninger kjørt mot dagens datagrunnlag. */
  live: TmfVersionTotals | null;
  /** Hvorfor live-tallet mangler, når det mangler. */
  liveUnavailableReason: string | null;
  /** Faktiske registreringer i målåret så langt. Null før året har startet. */
  actual: TmfVersionActual | null;
}

export interface TmfVersionTrackingInput {
  id: string;
  name: string;
  description: string | null;
  target_year: number;
  created_at: string;
  config: TmfBudgetConfig;
  snapshot: TmfBudgetSnapshot | null;
}

function actualsForYear(
  rows: TmfMonthlyMarketRow[],
  year: number,
): TmfVersionActual | null {
  const prefix = `${year}-`;
  const months = new Set<string>();
  let market = 0;
  let volvo = 0;

  for (const row of rows) {
    if (!row.month.startsWith(prefix)) continue;
    months.add(row.month.slice(0, 7));
    market += row.count;
    volvo += row.volvo_count;
  }

  if (months.size === 0) return null;

  return { market, volvo, months: months.size, complete: months.size >= 12 };
}

/**
 * Hvor inneværende år lander: faktisk t.o.m. siste fullførte måned, prognose
 * for resten. Speiler modellens eget landingsanslag, men per segment slik at
 * Volvo-tallet bruker segmentets egen andel i stedet for et snitt.
 */
function landingTotals(currentYear: TmfForecastResult): TmfVersionTotals {
  const actualThroughMonth = currentYear.total.landingActualMonths;

  const segments = currentYear.segments.map((segment) => {
    const market = segment.monthly.reduce((sum, point) => {
      const useActual = point.month <= actualThroughMonth && point.actual != null;
      return sum + (useActual ? point.actual! : point.adjustedForecast);
    }, 0);
    return {
      pabygg: String(segment.pabygg),
      label: segment.label,
      market,
      volvo: market * (segment.baseline.volvoSharePct / 100),
    };
  });

  return {
    market: currentYear.total.annualLandingEstimate,
    volvo: segments.reduce((sum, segment) => sum + segment.volvo, 0),
    segments,
  };
}

/**
 * Henter dagens tall for et gitt målår.
 *
 * Et målår starter som «neste år» i modellen og blir etter nyttår «inneværende
 * år». Da er landingsanslaget det riktige live-tallet, siden en ren årsprognose
 * ignorerer månedene som allerede er registrert.
 */
function liveTotalsForYear(
  estimate: TmfEstimateResult,
  targetYear: number,
): { totals: TmfVersionTotals | null; reason: string | null } {
  if (targetYear === estimate.nextYear.year) {
    return {
      totals: {
        market: estimate.nextYear.total.annualMarket,
        volvo: estimate.nextYear.total.annualVolvo,
        segments: estimate.nextYear.segments.map((segment) => ({
          pabygg: String(segment.pabygg),
          label: segment.label,
          market: segment.annualMarket,
          volvo: segment.annualVolvo,
        })),
      },
      reason: null,
    };
  }

  if (targetYear === estimate.currentYear.year) {
    return { totals: landingTotals(estimate.currentYear), reason: null };
  }

  return {
    totals: null,
    reason:
      targetYear < estimate.currentYear.year
        ? "Målåret er historikk — mål mot faktisk."
        : "Modellen prognoserer ikke så langt fram.",
  };
}

export function buildTmfVersionTracking(options: {
  versions: TmfVersionTrackingInput[];
  rows: TmfMonthlyMarketRow[];
  driverGroups: Parameters<typeof buildTmfEstimate>[1];
  now: Date;
  backtest: TmfBacktestResult;
  calibration: TmfCalibrationInfo;
  commercialIndicators?: TmfCommercialIndicator[];
}): TmfVersionTrackingRow[] {
  const {
    versions,
    rows,
    driverGroups,
    now,
    backtest,
    calibration,
    commercialIndicators = [],
  } = options;

  // Versjoner deler ofte forutsetninger; da er live-tallet det samme.
  const liveCache = new Map<string, TmfEstimateResult>();
  const actualCache = new Map<number, TmfVersionActual | null>();

  return versions.map((version) => {
    const configKey = JSON.stringify(version.config);
    let liveEstimate = liveCache.get(configKey);
    if (!liveEstimate) {
      liveEstimate = buildTmfEstimate(
        rows,
        driverGroups,
        {
          scenarioId: version.config.scenario,
          segmentAdjustments: version.config.segmentAdjustments,
          volvoShareOverrides: version.config.volvoShareOverrides,
        },
        now,
        backtest,
        calibration,
        commercialIndicators,
      );
      liveCache.set(configKey, liveEstimate);
    }

    if (!actualCache.has(version.target_year)) {
      actualCache.set(version.target_year, actualsForYear(rows, version.target_year));
    }

    const live = liveTotalsForYear(liveEstimate, version.target_year);

    return {
      id: version.id,
      name: version.name,
      description: version.description,
      targetYear: version.target_year,
      createdAt: version.created_at,
      config: version.config,
      configLabel: describeTmfBudgetConfig(version.config),
      configHref: `/tmf?${buildTmfPageSearchParams(version.config).toString()}`,
      snapshot: version.snapshot,
      live: live.totals,
      liveUnavailableReason: live.reason,
      actual: actualCache.get(version.target_year) ?? null,
    };
  });
}
