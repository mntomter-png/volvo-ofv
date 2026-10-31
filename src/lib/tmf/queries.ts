import {
  parseTmfEstimateInput,
  type TmfEstimateInput,
} from "@/lib/tmf/adjustments";
import { buildTmfEstimate } from "@/lib/tmf/model";
import { readCachedTmfModelSnapshot } from "@/lib/tmf/model-cache";
import {
  tmfModelCacheKey,
  tmfModelDayKey,
} from "@/lib/tmf/model-cache-key";
import { fitTmfModel, type TmfModelSnapshot } from "@/lib/tmf/model-fit";
import { fetchTmfMonthlyMarketRows } from "@/lib/tmf/model-inputs";
import { getTmfBudgetVersions, type TmfBudgetVersionRow } from "@/lib/tmf/budget-queries";
import {
  buildTmfVersionTracking,
  type TmfVersionTrackingRow,
} from "@/lib/tmf/version-tracking";
import type { TmfBacktestResult, TmfEstimateResult, TmfMonthlyMarketRow } from "@/lib/tmf/types";
import {
  buildDriverGroups,
  fetchSsbIndicatorPoints,
  getSsbSyncStatus,
  type SsbDriverGroup,
} from "@/lib/ssb/queries";
import { createClient } from "@/lib/supabase/server";
import type { SyncType } from "@/lib/supabase/types";
import type { TmfSupabase } from "@/lib/tmf/model-inputs";
import { getTmfCommercialIndicators } from "@/lib/tmf/commercial-queries";
import {
  getTmfRenewalPool,
  getTmfRenewalSnapshotCoverage,
  type TmfRenewalSnapshotCoverage,
} from "@/lib/tmf/renewal-queries";
import { isTmfScenarioId, type TmfScenarioId } from "@/lib/tmf/scenarios";

function hasTmfModelCacheCredentials(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

const REGISTRATION_SYNC_TYPES: SyncType[] = ["registrations", "full"];

function asDbClient(client: unknown): TmfSupabase {
  return client as TmfSupabase;
}

/** Siste OFV-versjon som faktisk skrev nyregistreringer. Populasjon og SSB teller ikke. */
async function getLatestRegistrationsDataVersion(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sync_logs")
    .select("ofv_data_version")
    .eq("status", "completed")
    .in("sync_type", REGISTRATION_SYNC_TYPES)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ ofv_data_version: number | null }>();

  if (error) throw new Error(error.message);
  return data?.ofv_data_version ?? null;
}

async function computeTmfModelSnapshot(
  focusMake: string,
  reference: Date,
): Promise<TmfModelSnapshot> {
  const supabase = asDbClient(await createClient());
  const [rows, ssbPoints] = await Promise.all([
    fetchTmfMonthlyMarketRows(supabase, focusMake, reference),
    fetchSsbIndicatorPoints(supabase),
  ]);
  const driverGroups = buildDriverGroups(ssbPoints);
  return {
    rows,
    driverGroups,
    ssbPoints,
    ...fitTmfModel(rows, driverGroups, ssbPoints, reference),
  };
}

/**
 * Backtest og kalibrering over 8 års historikk. Resultatet gjenbrukes til
 * registreringsversjonen, SSB-synken eller kalenderdagen endrer seg.
 * Scenario, justeringer, ordre og fornyelse ligger utenfor cachen.
 */
async function getTmfModelSnapshot(
  reference = new Date(),
  focusMake = "Volvo",
): Promise<TmfModelSnapshot> {
  if (!hasTmfModelCacheCredentials()) {
    return computeTmfModelSnapshot(focusMake, reference);
  }

  let dataVersion: number | null = null;
  let ssbSyncedAt: string | null = null;
  try {
    const [version, ssb] = await Promise.all([
      getLatestRegistrationsDataVersion(),
      getSsbSyncStatus(),
    ]);
    dataVersion = version;
    ssbSyncedAt = ssb.lastSyncAt;
  } catch (error) {
    console.error(
      "TMF-modellcache: fant ikke dataversjon, beregner direkte:",
      error instanceof Error ? error.message : error,
    );
    return computeTmfModelSnapshot(focusMake, reference);
  }

  // Uten versjon vet vi ikke når neste synk lander. Ikke lås et treff.
  if (dataVersion == null) {
    return computeTmfModelSnapshot(focusMake, reference);
  }

  const day = tmfModelDayKey(reference);
  const cacheKey = tmfModelCacheKey({
    dataVersion,
    ssbSyncedAt,
    day,
    focusMake,
  });

  try {
    return await readCachedTmfModelSnapshot(cacheKey, day, focusMake);
  } catch (error) {
    console.error(
      "TMF-modellcache feilet, beregner direkte:",
      error instanceof Error ? error.message : error,
    );
    return computeTmfModelSnapshot(focusMake, reference);
  }
}

export async function getTmfMonthlyMarketRows(
  focusMake = "Volvo",
): Promise<TmfMonthlyMarketRow[]> {
  return fetchTmfMonthlyMarketRows(asDbClient(await createClient()), focusMake, new Date());
}

export async function getTmfEstimate(
  input?: Partial<TmfEstimateInput>,
): Promise<TmfEstimateResult> {
  const resolved: TmfEstimateInput = {
    scenarioId: input?.scenarioId ?? "basis",
    segmentAdjustments: input?.segmentAdjustments ?? {},
    volvoShareOverrides: input?.volvoShareOverrides ?? {},
  };

  const reference = new Date();
  const [snapshot, commercialIndicators, renewalPool] = await Promise.all([
    getTmfModelSnapshot(reference),
    getTmfCommercialIndicators(),
    getTmfRenewalPool(),
  ]);
  return buildTmfEstimate(
    snapshot.rows,
    snapshot.driverGroups,
    resolved,
    reference,
    snapshot.backtest,
    snapshot.calibration,
    commercialIndicators,
    renewalPool,
  );
}

export async function getTmfBacktest(): Promise<TmfBacktestResult> {
  const snapshot = await getTmfModelSnapshot();
  return snapshot.backtest;
}

export async function getTmfPageData(input?: Partial<TmfEstimateInput>): Promise<{
  estimate: TmfEstimateResult;
  backtest: TmfBacktestResult;
  driverGroups: SsbDriverGroup[];
  budgets: TmfBudgetVersionRow[];
  versionTracking: TmfVersionTrackingRow[];
  renewalSnapshotCoverage: TmfRenewalSnapshotCoverage;
}> {
  const resolved: TmfEstimateInput = {
    scenarioId: input?.scenarioId ?? "basis",
    segmentAdjustments: input?.segmentAdjustments ?? {},
    volvoShareOverrides: input?.volvoShareOverrides ?? {},
  };

  const now = new Date();
  const [
    snapshot,
    budgets,
    commercialIndicators,
    renewalPool,
    renewalSnapshotCoverage,
  ] = await Promise.all([
    getTmfModelSnapshot(now),
    getTmfBudgetVersions(),
    getTmfCommercialIndicators(),
    getTmfRenewalPool(),
    getTmfRenewalSnapshotCoverage(),
  ]);

  const { rows, driverGroups, backtest, calibration } = snapshot;
  const estimate = buildTmfEstimate(
    rows,
    driverGroups,
    resolved,
    now,
    backtest,
    calibration,
    commercialIndicators,
    renewalPool,
  );

  // Gjenbruker rader, kalibrering og backtest, så sporingen bare koster CPU.
  const versionTracking = buildTmfVersionTracking({
    versions: budgets,
    rows,
    driverGroups,
    now,
    backtest,
    calibration,
    commercialIndicators,
    renewalPool,
  });

  return {
    estimate,
    backtest,
    driverGroups,
    budgets,
    versionTracking,
    renewalSnapshotCoverage,
  };
}

export function parseTmfScenarioParam(value: string | string[] | undefined): TmfScenarioId {
  const raw = typeof value === "string" ? value : "basis";
  return isTmfScenarioId(raw) ? raw : "basis";
}

export function parseTmfPageInput(
  params: Record<string, string | string[] | undefined>,
): TmfEstimateInput {
  return parseTmfEstimateInput(params);
}

export type { TmfEstimateResult };
