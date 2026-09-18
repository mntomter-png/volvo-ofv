/**
 * Kjør kalibrering og backtest mot live OFV-data, og skriv ut vekten,
 * MAPE og neste års estimat. Sidene viser det samme, men dette er
 * raskere når du endrer TMF-modellen og vil se tallet før UI-en.
 *
 *   npm run verify:tmf
 */
import { subYears, format } from "date-fns";

import { createAdminClient } from "@/lib/supabase/admin-core";
import { runTmfBacktest } from "@/lib/tmf/backtest";
import { calibrateDriverWeight } from "@/lib/tmf/calibration";
import { driverConfigFromCalibration } from "@/lib/tmf/drivers";
import { buildTmfEstimate } from "@/lib/tmf/model";

async function main() {
  const supabase = createAdminClient();
  const from = format(subYears(new Date(), 8), "yyyy-MM-dd");

  const { data, error } = await supabase
    .rpc("tmf_monthly_market", { p_from: from, p_to: null, p_focus_make: "Volvo" })
    .returns<
      { month: string; pabygg: string; count: number; volvo_count: number; emob_count: number }[]
    >();
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => ({ ...row, emob_count: row.emob_count ?? 0 }));

  // SSB-spørringene er request-scoped; drivere er uansett kalibrert nær null.
  const driverGroups: never[] = [];
  const now = new Date();

  const calibration = calibrateDriverWeight(rows, driverGroups, now);
  console.log("=== Kalibrering ===");
  console.log("trendWeight:      ", calibration.trendWeight);
  console.log("shareTrendWeight: ", calibration.shareTrendWeight);
  console.log("signalWeight:     ", calibration.signalWeight);
  console.log("macroWeight:      ", calibration.macroWeight);
  console.log("\nTrendkandidater (markeds-MAPE):");
  for (const c of calibration.trendCandidates) {
    console.log(`  ${c.trendWeight} → ${c.mape.toFixed(2)} %`);
  }
  console.log("\nAndelskandidater (Volvo-MAPE):");
  for (const c of calibration.shareCandidates) {
    console.log(`  ${c.shareTrendWeight} → ${c.volvoMape.toFixed(2)} %`);
  }

  const backtest = runTmfBacktest(rows, driverGroups, [], now, driverConfigFromCalibration(calibration), {
    trendWeight: calibration.trendWeight,
    shareTrendWeight: calibration.shareTrendWeight,
  });

  const shipped = backtest.models.find((m) => m.modelId === "full_trend")!;
  console.log("\n=== Levert modell ===");
  console.log(shipped.description);
  console.log(`Marked: MAPE ${shipped.mapeTotal.toFixed(2)} %, bias ${shipped.biasPct.toFixed(2)} %, band -${shipped.downsidePct.toFixed(1)}/+${shipped.upsidePct.toFixed(1)}`);
  console.log(`Volvo:  MAPE ${shipped.volvoMapeTotal.toFixed(2)} %, bias ${shipped.volvoBiasPct.toFixed(2)} %, band -${shipped.volvoDownsidePct.toFixed(1)}/+${shipped.volvoUpsidePct.toFixed(1)}`);
  console.log("\nÅr for år:");
  for (const y of shipped.years) {
    console.log(
      `  ${y.year}: marked ${Math.round(y.forecastTotal)} vs ${y.actualTotal} (${y.errorPct.toFixed(1)} %)` +
        ` | Volvo ${Math.round(y.volvoForecastTotal)} vs ${y.volvoActualTotal} (${y.volvoErrorPct.toFixed(1)} %)`,
    );
  }

  const estimate = buildTmfEstimate(
    rows,
    driverGroups,
    { scenarioId: "basis", segmentAdjustments: {}, volvoShareOverrides: {} },
    now,
    backtest,
    calibration,
  );
  const targetYear = estimate.nextYear.year;
  console.log(`\n=== ${targetYear}-estimat ===`);
  console.log(`Marked ${Math.round(estimate.nextYear.total.annualMarket)}, Volvo ${Math.round(estimate.nextYear.total.annualVolvo)} (${estimate.nextYear.total.volvoSharePct.toFixed(1)} %)`);
  console.log(`Marked P10/P90: ${Math.round(estimate.confidence.market.p10)} / ${Math.round(estimate.confidence.market.p90)}`);
  console.log(`Volvo  P10/P90: ${Math.round(estimate.confidence.volvo.p10)} / ${Math.round(estimate.confidence.volvo.p90)}`);
  console.log("\nVolvo-andel per segment (trailing → brukt):");
  for (const s of estimate.nextYear.segments) {
    console.log(
      `  ${s.label}: ${s.volvoShareTrailingPct.toFixed(1)} % → ${s.volvoSharePct.toFixed(1)} %` +
        ` (YTD ${s.volvoShareYtdPct?.toFixed(1) ?? "-"} %, vekt ${s.volvoShareYtdWeight.toFixed(2)})`,
    );
  }
  console.log("\nNote:", calibration.note);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
