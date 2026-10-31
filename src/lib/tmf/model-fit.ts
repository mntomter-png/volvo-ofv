import type { SsbDriverGroup, SsbIndicatorPoint } from "@/lib/ssb/queries";
import { runTmfBacktest } from "@/lib/tmf/backtest";
import { calibrateDriverWeight } from "@/lib/tmf/calibration";
import { driverConfigFromCalibration } from "@/lib/tmf/drivers";
import type {
  TmfBacktestResult,
  TmfCalibrationResult,
  TmfMonthlyMarketRow,
} from "@/lib/tmf/types";

export interface TmfModelSnapshot {
  rows: TmfMonthlyMarketRow[];
  driverGroups: SsbDriverGroup[];
  ssbPoints: SsbIndicatorPoint[];
  calibration: TmfCalibrationResult;
  backtest: TmfBacktestResult;
}

/**
 * Kalibrering og backtest slik sidene har kjørt dem: samme rader, samme
 * referansedato, vektene fra kalibreringen inn i levert modell.
 */
export function fitTmfModel(
  rows: TmfMonthlyMarketRow[],
  driverGroups: SsbDriverGroup[],
  ssbPoints: SsbIndicatorPoint[],
  reference: Date,
): { calibration: TmfCalibrationResult; backtest: TmfBacktestResult } {
  const calibration = calibrateDriverWeight(rows, driverGroups, reference);
  const driverConfig = driverConfigFromCalibration(calibration);
  const backtest = runTmfBacktest(
    rows,
    driverGroups,
    ssbPoints,
    reference,
    driverConfig,
    {
      trendWeight: calibration.trendWeight,
      shareTrendWeight: calibration.shareTrendWeight,
    },
  );
  return { calibration, backtest };
}
