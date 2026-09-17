import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import {
  apiErrorResponse,
  requireApiPageAccess,
} from "@/lib/auth/api-access";
import {
  exportFilename,
  excelResponse,
  toExcelWorkbookBuffer,
  type ExportColumn,
  type ExcelSheet,
} from "@/lib/export/excel";
import { parseTmfEstimateInput } from "@/lib/tmf/adjustments";
import { getTmfEstimate } from "@/lib/tmf/queries";

function round(value: number): number {
  return Math.round(value);
}

export async function GET(request: Request) {
  try {
    const user = await requireApiPageAccess("tmf");
    const limited = await assertExportRateLimit({
      request,
      userId: user.id,
      route: "tmf",
    });
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const input = parseTmfEstimateInput({
      scenario: searchParams.get("scenario") ?? undefined,
      adj: searchParams.get("adj") ?? undefined,
      volvo: searchParams.get("volvo") ?? undefined,
    });

    const estimate = await getTmfEstimate(input);
  const { currentYear, nextYear, confidence, calibration } = estimate;

  const summaryRows = [
    {
      label: `YTD faktisk ${currentYear.year}`,
      value: currentYear.total.ytdActual,
    },
    {
      label: `YTD justert prognose ${currentYear.year}`,
      value: round(currentYear.total.ytdAdjustedForecast),
    },
    {
      label: `Årsprognose ${currentYear.year}`,
      value: round(currentYear.total.annualAdjustedForecast),
    },
    {
      label: `TMF totalt ${nextYear.year} (P50)`,
      value: round(nextYear.total.annualMarket),
    },
    {
      label: `TMF ${nextYear.year} P10`,
      value: round(confidence.market.p10),
    },
    {
      label: `TMF ${nextYear.year} P90`,
      value: round(confidence.market.p90),
    },
    {
      label: `Volvo-estimat ${nextYear.year} (P50)`,
      value: round(nextYear.total.annualVolvo),
    },
    {
      label: `Volvo ${nextYear.year} P10`,
      value: round(confidence.volvo.p10),
    },
    {
      label: `Volvo ${nextYear.year} P90`,
      value: round(confidence.volvo.p90),
    },
    {
      label: `Volvo-andel ${nextYear.year} (%)`,
      value: Number(nextYear.total.volvoSharePct.toFixed(1)),
    },
    {
      label: `EMOB ${nextYear.year}`,
      value: round(nextYear.total.annualEmob),
    },
    {
      label: `Diesel ${nextYear.year}`,
      value: round(nextYear.total.annualDiesel),
    },
    {
      label: `Gass ${nextYear.year}`,
      value: round(nextYear.total.annualGas),
    },
    {
      label: `EMOB-andel ${nextYear.year} (%)`,
      value: Number(nextYear.total.emobSharePct.toFixed(1)),
    },
    { label: "Scenario", value: estimate.scenarioLabel },
    {
      label: "SSB-signalvekt",
      value: calibration.signalWeight,
    },
    {
      label: "MAPE OFV-kjerne (%)",
      value: Number(calibration.coreMape.toFixed(1)),
    },
    {
      label: "Scope",
      value: "OFV nyregistreringer N3 ≥16t (ikke leveranser)",
    },
  ];

  const summaryColumns: ExportColumn<(typeof summaryRows)[number]>[] = [
    { header: "Nøkkeltall", value: (row) => row.label },
    { header: "Verdi", value: (row) => row.value },
  ];

  const nextYearSegmentColumns: ExportColumn<(typeof nextYear.segments)[number]>[] = [
    { header: "Segment", value: (row) => row.label },
    {
      header: "Trend effektiv (%)",
      value: (row) => Number(row.trend.cagrPct.toFixed(1)),
    },
    {
      header: "Trend historisk CAGR (%)",
      value: (row) => Number(row.trend.historicalCagrPct.toFixed(1)),
    },
    {
      header: "Trend YTD (%)",
      value: (row) =>
        row.trend.ytdMomentumPct == null
          ? ""
          : Number(row.trend.ytdMomentumPct.toFixed(1)),
    },
    {
      header: "YTD-vekt",
      value: (row) => Number(row.trend.ytdWeight.toFixed(2)),
    },
    { header: "Driverfaktor", value: (row) => Number(row.driverMultiplier.toFixed(2)) },
    {
      header: "Analytikerjustering (%)",
      value: (row) => row.analystAdjustmentPct || 0,
    },
    { header: "Marked", value: (row) => round(row.annualMarket) },
    {
      header: "EMOB-andel (%)",
      value: (row) => Number(row.emobSharePct.toFixed(1)),
    },
    { header: "EMOB", value: (row) => round(row.annualEmob) },
    { header: "Diesel", value: (row) => round(row.annualDiesel) },
    { header: "Gass", value: (row) => round(row.annualGas) },
    {
      header: "Volvo-andel (%)",
      value: (row) => Number(row.volvoSharePct.toFixed(1)),
    },
    {
      header: "Volvo overstyrt",
      value: (row) => (row.volvoShareOverridden ? "Ja" : "Nei"),
    },
    { header: "Volvo-estimat", value: (row) => round(row.annualVolvo) },
  ];

  const monthlyColumns: ExportColumn<(typeof currentYear.total.monthly)[number]>[] = [
    { header: "Måned", value: (row) => row.monthLabel },
    { header: "Faktisk", value: (row) => row.actual },
    { header: "Baseline", value: (row) => round(row.forecast) },
    { header: "Justert prognose", value: (row) => round(row.adjustedForecast) },
  ];

  const nextYearMonthly = nextYear.total.monthly.map((row) => ({
    monthLabel: row.monthLabel,
    forecast: round(row.forecast),
    adjustedForecast: round(row.adjustedForecast),
  }));

  const nextYearMonthlyColumns: ExportColumn<(typeof nextYearMonthly)[number]>[] = [
    { header: "Måned", value: (row) => row.monthLabel },
    { header: "Baseline", value: (row) => row.forecast },
    { header: "Justert prognose", value: (row) => row.adjustedForecast },
  ];

  const segmentMonthlyRows = nextYear.segments.flatMap((segment) =>
    segment.monthly.map((month) => ({
      segment: segment.label,
      month: month.monthLabel,
      market: round(month.adjustedForecast),
      volvo: round(month.adjustedForecast * (segment.volvoSharePct / 100)),
    })),
  );

  const segmentMonthlyColumns: ExportColumn<(typeof segmentMonthlyRows)[number]>[] = [
    { header: "Segment", value: (row) => row.segment },
    { header: "Måned", value: (row) => row.month },
    { header: "Marked", value: (row) => row.market },
    { header: "Volvo-estimat", value: (row) => row.volvo },
  ];

  const buffer = toExcelWorkbookBuffer([
    { name: "Sammendrag", rows: summaryRows, columns: summaryColumns },
    {
      name: `Neste år ${nextYear.year}`,
      rows: nextYear.segments,
      columns: nextYearSegmentColumns,
    },
    {
      name: `Måned ${currentYear.year}`,
      rows: currentYear.total.monthly,
      columns: monthlyColumns,
    },
    {
      name: `Måned ${nextYear.year}`,
      rows: nextYearMonthly,
      columns: nextYearMonthlyColumns,
    },
    {
      name: "Segment månedlig",
      rows: segmentMonthlyRows,
      columns: segmentMonthlyColumns,
    },
  ] as ExcelSheet<unknown>[]);

  return excelResponse(
    buffer,
    exportFilename(`tmf-${estimate.scenario}-${nextYear.year}`),
  );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
