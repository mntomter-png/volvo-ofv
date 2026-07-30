import { subYears, format } from "date-fns";

import {
  parseTmfEstimateInput,
  type TmfEstimateInput,
} from "@/lib/tmf/adjustments";
import { calibrateDriverWeight } from "@/lib/tmf/calibration";
import { runTmfBacktest } from "@/lib/tmf/backtest";
import { driverConfigFromCalibration } from "@/lib/tmf/drivers";
import { buildTmfEstimate } from "@/lib/tmf/model";
import type { TmfBacktestResult, TmfEstimateResult, TmfMonthlyMarketRow } from "@/lib/tmf/types";
import { getSsbDriverGroups, getSsbIndicatorPoints } from "@/lib/ssb/queries";
import { createClient } from "@/lib/supabase/server";
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
      }[]
    >();

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    month: row.month,
    pabygg: row.pabygg,
    count: row.count,
    volvo_count: row.volvo_count,
    emob_count: row.emob_count ?? 0,
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

  const [rows, driverGroups, ssbPoints] = await Promise.all([
    getTmfMonthlyMarketRows(),
    getSsbDriverGroups(),
    getSsbIndicatorPoints(),
  ]);
  const calibration = calibrateDriverWeight(rows, driverGroups);
  const driverConfig = driverConfigFromCalibration(calibration);
  const backtest = runTmfBacktest(rows, driverGroups, ssbPoints, new Date(), driverConfig);
  return buildTmfEstimate(rows, driverGroups, resolved, new Date(), backtest, calibration);
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
  );
}

export async function getTmfPageData(input?: Partial<TmfEstimateInput>): Promise<{
  estimate: TmfEstimateResult;
  backtest: TmfBacktestResult;
  driverGroups: Awaited<ReturnType<typeof getSsbDriverGroups>>;
}> {
  const resolved: TmfEstimateInput = {
    scenarioId: input?.scenarioId ?? "basis",
    segmentAdjustments: input?.segmentAdjustments ?? {},
    volvoShareOverrides: input?.volvoShareOverrides ?? {},
  };

  const [rows, driverGroups, ssbPoints] = await Promise.all([
    getTmfMonthlyMarketRows(),
    getSsbDriverGroups(),
    getSsbIndicatorPoints(),
  ]);

  const calibration = calibrateDriverWeight(rows, driverGroups);
  const driverConfig = driverConfigFromCalibration(calibration);
  const backtest = runTmfBacktest(rows, driverGroups, ssbPoints, new Date(), driverConfig);
  const estimate = buildTmfEstimate(
    rows,
    driverGroups,
    resolved,
    new Date(),
    backtest,
    calibration,
  );

  return {
    estimate,
    backtest,
    driverGroups,
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
