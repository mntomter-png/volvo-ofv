import { subYears, format } from "date-fns";

import {
  parseTmfEstimateInput,
  type TmfEstimateInput,
} from "@/lib/tmf/adjustments";
import { calibrateDriverWeight } from "@/lib/tmf/calibration";
import { runTmfBacktest } from "@/lib/tmf/backtest";
import { driverConfigFromCalibration } from "@/lib/tmf/drivers";
import { buildTmfEstimate } from "@/lib/tmf/model";
import { getTmfBudgetVersions, type TmfBudgetVersionRow } from "@/lib/tmf/budget-queries";
import {
  buildTmfVersionTracking,
  type TmfVersionTrackingRow,
} from "@/lib/tmf/version-tracking";
import type { TmfBacktestResult, TmfEstimateResult, TmfMonthlyMarketRow } from "@/lib/tmf/types";
import { getSsbDriverGroups, getSsbIndicatorPoints } from "@/lib/ssb/queries";
import { createClient } from "@/lib/supabase/server";
import { getTmfCommercialIndicators } from "@/lib/tmf/commercial-queries";
import { assessTmfDataAge, type TmfDataAgeReport, type TmfOfvFreshness } from "@/lib/tmf/data-age";
import {
  getTmfRenewalPool,
  getTmfRenewalSnapshotCoverage,
  type TmfRenewalSnapshotCoverage,
} from "@/lib/tmf/renewal-queries";
import { isTmfScenarioId, type TmfScenarioId } from "@/lib/tmf/scenarios";

type RpcClient = {
  rpc: (
    fn: "tmf_monthly_market",
    args: { p_from?: string | null; p_to?: string | null; p_focus_make?: string },
  ) => {
    returns: <T>() => Promise<{ data: T | null; error: { message: string } | null }>;
  };
};

export async function getTmfMonthlyMarketRows(
  focusMake = "Volvo",
): Promise<TmfMonthlyMarketRow[]> {
  const supabase = await createClient();
  const from = format(subYears(new Date(), 8), "yyyy-MM-dd");

  const { data, error } = await (supabase as unknown as RpcClient)
    .rpc("tmf_monthly_market", { p_from: from, p_to: null, p_focus_make: focusMake })
    .returns<
      {
        month: string;
        pabygg: string;
        count: number;
        volvo_count: number;
        emob_count: number;
        diesel_count: number;
        gas_count: number;
        other_count: number;
      }[]
    >();

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    month: row.month,
    pabygg: row.pabygg,
    count: row.count,
    volvo_count: row.volvo_count,
    emob_count: row.emob_count ?? 0,
    diesel_count: row.diesel_count ?? 0,
    gas_count: row.gas_count ?? 0,
    other_count: row.other_count ?? 0,
  }));
}

export async function getTmfEstimate(
  input?: Partial<TmfEstimateInput>,
): Promise<TmfEstimateResult> {
  const resolved: TmfEstimateInput = {
    scenarioId: input?.scenarioId ?? "basis",
    segmentAdjustments: input?.segmentAdjustments ?? {},
    volvoShareOverrides: input?.volvoShareOverrides ?? {},
  };

  const [rows, driverGroups, ssbPoints, commercialIndicators, renewalPool] = await Promise.all([
    getTmfMonthlyMarketRows(),
    getSsbDriverGroups(),
    getSsbIndicatorPoints(),
    getTmfCommercialIndicators(),
    getTmfRenewalPool(),
  ]);
  const calibration = calibrateDriverWeight(rows, driverGroups);
  const driverConfig = driverConfigFromCalibration(calibration);
  const backtest = runTmfBacktest(
    rows,
    driverGroups,
    ssbPoints,
    new Date(),
    driverConfig,
    { trendWeight: calibration.trendWeight, shareTrendWeight: calibration.shareTrendWeight },
  );
  return buildTmfEstimate(
    rows,
    driverGroups,
    resolved,
    new Date(),
    backtest,
    calibration,
    commercialIndicators,
    renewalPool,
  );
}

export async function getTmfBacktest(): Promise<TmfBacktestResult> {
  const [rows, driverGroups, ssbPoints] = await Promise.all([
    getTmfMonthlyMarketRows(),
    getSsbDriverGroups(),
    getSsbIndicatorPoints(),
  ]);
  const calibration = calibrateDriverWeight(rows, driverGroups);
  return runTmfBacktest(
    rows,
    driverGroups,
    ssbPoints,
    new Date(),
    driverConfigFromCalibration(calibration),
    { trendWeight: calibration.trendWeight, shareTrendWeight: calibration.shareTrendWeight },
  );
}

export async function getTmfPageData(input?: Partial<TmfEstimateInput>): Promise<{
  estimate: TmfEstimateResult;
  backtest: TmfBacktestResult;
  driverGroups: Awaited<ReturnType<typeof getSsbDriverGroups>>;
  budgets: TmfBudgetVersionRow[];
  versionTracking: TmfVersionTrackingRow[];
  renewalSnapshotCoverage: TmfRenewalSnapshotCoverage;
  dataAge: TmfDataAgeReport;
}> {
  const resolved: TmfEstimateInput = {
    scenarioId: input?.scenarioId ?? "basis",
    segmentAdjustments: input?.segmentAdjustments ?? {},
    volvoShareOverrides: input?.volvoShareOverrides ?? {},
  };

  const [
    rows,
    driverGroups,
    ssbPoints,
    budgets,
    commercialIndicators,
    renewalPool,
    renewalSnapshotCoverage,
    ofvFreshness,
  ] = await Promise.all([
      getTmfMonthlyMarketRows(),
      getSsbDriverGroups(),
      getSsbIndicatorPoints(),
      getTmfBudgetVersions(),
      getTmfCommercialIndicators(),
      getTmfRenewalPool(),
      getTmfRenewalSnapshotCoverage(),
      getOfvInputFreshness(),
    ]);

  const now = new Date();
  const calibration = calibrateDriverWeight(rows, driverGroups);
  const driverConfig = driverConfigFromCalibration(calibration);
  const backtest = runTmfBacktest(
    rows,
    driverGroups,
    ssbPoints,
    now,
    driverConfig,
    { trendWeight: calibration.trendWeight, shareTrendWeight: calibration.shareTrendWeight },
  );
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

  const dataAge = assessTmfDataAge({
    now,
    commercial: commercialIndicators,
    ssbIndicators: driverGroups.flatMap((group) =>
      group.indicators.map((indicator) => ({
        indicatorKey: indicator.indicator_key,
        label: indicator.label,
        latestPeriod: indicator.latestPeriod,
      })),
    ),
    registrations: ofvFreshness.registrations,
    population: ofvFreshness.population,
  });

  return {
    estimate,
    backtest,
    driverGroups,
    budgets,
    versionTracking,
    renewalSnapshotCoverage,
    dataAge,
  };
}

/**
 * Siste OFV-dato for nyregistreringer og bestand. sync_logs er en liten
 * tabell (én rad per synk). Bestandsdatoen leses som én rad via
 * population_snapshot_date_idx.
 */
async function getOfvInputFreshness(): Promise<{
  registrations: TmfOfvFreshness;
  population: TmfOfvFreshness;
}> {
  const supabase = await createClient();

  const [registrationsRes, populationSyncRes, snapshotRes] = await Promise.all([
    supabase
      .from("sync_logs")
      .select("completed_at, ofv_publish_date")
      .eq("status", "completed")
      .in("sync_type", ["full", "registrations"])
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ completed_at: string | null; ofv_publish_date: string | null }>(),
    supabase
      .from("sync_logs")
      .select("completed_at, ofv_publish_date")
      .eq("status", "completed")
      .in("sync_type", ["full", "population"])
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ completed_at: string | null; ofv_publish_date: string | null }>(),
    supabase
      .from("population")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle<{ snapshot_date: string }>(),
  ]);

  if (registrationsRes.error) throw new Error(registrationsRes.error.message);
  if (populationSyncRes.error) throw new Error(populationSyncRes.error.message);
  if (snapshotRes.error) throw new Error(snapshotRes.error.message);

  return {
    registrations: {
      publishDate: registrationsRes.data?.ofv_publish_date ?? null,
      syncedAt: registrationsRes.data?.completed_at ?? null,
    },
    population: {
      publishDate: snapshotRes.data?.snapshot_date ?? null,
      syncedAt: populationSyncRes.data?.completed_at ?? null,
    },
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
