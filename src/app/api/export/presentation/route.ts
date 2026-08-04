import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import { requirePageAccess } from "@/lib/auth/roles";
import { getUserBrand } from "@/lib/brand/user-brand";
import {
  excelResponse,
  exportFilename,
  toExcelWorkbookBuffer,
  type ExcelSheet,
} from "@/lib/export/excel";
import { getPresentationDeckData } from "@/lib/presentation/queries";

export async function GET(request: Request) {
  try {
    const user = await requirePageAccess("presentasjon");
    const limited = await assertExportRateLimit({
      request,
      userId: user.id,
      route: "presentation",
    });
    if (limited) return limited;

    const brand = getUserBrand(user);
    const data = await getPresentationDeckData(brand.makeName);

    const sheets: ExcelSheet<Record<string, unknown>>[] = [
      {
        name: "Volum per år",
        rows: data.volumeByYear.map((row) => ({ ...row })),
        columns: [
          { header: "År", value: (r) => r.year },
          { header: "Enheter", value: (r) => r.count },
          {
            header: "TMF prognose",
            value: (r) =>
              r.forecastCount != null ? Number(r.forecastCount) : "",
          },
          { header: `${data.focusMake}`, value: (r) => r.focusCount },
          { header: "Elektrisk", value: (r) => r.electricCount },
          { header: "YTD", value: (r) => (r.partial ? "Ja" : "") },
        ],
      },
      {
        name: "Merkeandel",
        rows: data.makeSharePeriods.flatMap((period) =>
          period.rows.map((row) => ({
            period: period.label,
            make: row.name,
            count: row.count,
            total: period.total,
          })),
        ),
        columns: [
          { header: "Periode", value: (r) => r.period },
          { header: "Merke", value: (r) => r.make },
          { header: "Enheter", value: (r) => r.count },
          { header: "Totalt i periode", value: (r) => r.total },
        ],
      },
      {
        name: "Segmenter",
        rows: data.segmentShares.map((row) => ({ ...row })),
        columns: [
          { header: "Segment", value: (r) => r.label },
          { header: "Totalt", value: (r) => r.total },
          { header: `${data.focusMake}`, value: (r) => r.focusCount },
          {
            header: `${data.focusMake} andel`,
            value: (r) => Number(r.focusShare),
          },
          { header: "Største konkurrent", value: (r) => r.topCompetitor },
          {
            header: "Konkurrent andel",
            value: (r) => Number(r.topCompetitorShare),
          },
        ],
      },
      {
        name: "Drivlinje",
        rows: data.fuelMix.map((row) => ({ ...row })),
        columns: [
          { header: "Drivlinje", value: (r) => r.fuel },
          { header: "Enheter", value: (r) => r.count },
          { header: "Andel", value: (r) => Number(r.share) },
        ],
      },
      {
        name: "El per segment",
        rows: data.electricByBodywork.map((row) => ({ ...row })),
        columns: [
          { header: "Segment", value: (r) => r.label },
          { header: "Totalt", value: (r) => r.total },
          { header: "El", value: (r) => r.electricCount },
          { header: "El-andel", value: (r) => Number(r.electricShare) },
        ],
      },
      {
        name: "Gass",
        rows: data.gasByBodywork.map((row) => ({ ...row })),
        columns: [
          { header: "Segment", value: (r) => r.label },
          { header: "Totalt", value: (r) => r.total },
          { header: "Gass", value: (r) => r.gasCount },
          { header: "Gassandel", value: (r) => Number(r.gasShare) },
        ],
      },
      {
        name: "El merker",
        rows: data.electricMakeShare.rows.map((row) => ({ ...row })),
        columns: [
          { header: "Merke", value: (r) => r.name },
          { header: "Enheter", value: (r) => r.count },
        ],
      },
    ];

    return excelResponse(
      toExcelWorkbookBuffer(sheets as ExcelSheet<unknown>[]),
      exportFilename("presentasjon"),
    );
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
