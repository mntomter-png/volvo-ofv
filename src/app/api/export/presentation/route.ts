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
      {
        name: "Flow vs park",
        rows: [
          {
            metric: "Nyregistrering",
            total: data.flowStock.flowTotal,
            focus: data.flowStock.flowFocusCount,
            share: data.flowStock.flowShare,
          },
          {
            metric: "Park",
            total: data.flowStock.stockTotal,
            focus: data.flowStock.stockFocusCount,
            share: data.flowStock.stockShare,
          },
        ],
        columns: [
          { header: "Metrikk", value: (r) => r.metric },
          { header: "Totalt", value: (r) => r.total },
          { header: data.focusMake, value: (r) => r.focus },
          { header: "Andel", value: (r) => Number(r.share) },
        ],
      },
      {
        name: "Regioner",
        rows: data.regionShares.map((row) => ({ ...row })),
        columns: [
          { header: "Region", value: (r) => r.label },
          { header: "Totalt", value: (r) => r.count },
          { header: data.focusMake, value: (r) => r.focusCount },
          { header: "Andel", value: (r) => Number(r.focusShare) },
        ],
      },
      {
        name: "HK-mix",
        rows: data.hpShares.map((row) => ({ ...row })),
        columns: [
          { header: "HK", value: (r) => r.label },
          { header: "Totalt", value: (r) => r.count },
          { header: data.focusMake, value: (r) => r.focusCount },
          { header: "Andel", value: (r) => Number(r.focusShare) },
        ],
      },
      {
        name: "Lojalitet",
        rows: [
          {
            type: "Gjentak",
            owners: data.loyalty.repeat.owners,
            purchases: data.loyalty.repeat.purchases,
          },
          {
            type: "Nye",
            owners: data.loyalty.new.owners,
            purchases: data.loyalty.new.purchases,
          },
          {
            type: "Conquest",
            owners: data.loyalty.conquest.owners,
            purchases: data.loyalty.conquest.purchases,
          },
        ],
        columns: [
          { header: "Type", value: (r) => r.type },
          { header: "Eiere", value: (r) => r.owners },
          { header: "Kjøp", value: (r) => r.purchases },
        ],
      },
      {
        name: "TMF neste år",
        rows: data.tmfNextYear
          ? [
              {
                year: data.tmfNextYear.year,
                scenario: data.tmfNextYear.scenarioLabel,
                market: data.tmfNextYear.annualMarket,
                focus: data.tmfNextYear.annualVolvo,
                share: data.tmfNextYear.volvoSharePct / 100,
                emob: data.tmfNextYear.annualEmob,
                emobShare: data.tmfNextYear.emobSharePct / 100,
                p10: data.tmfNextYear.marketP10,
                p90: data.tmfNextYear.marketP90,
              },
            ]
          : [],
        columns: [
          { header: "År", value: (r) => r.year },
          { header: "Scenario", value: (r) => r.scenario },
          { header: "Marked", value: (r) => r.market },
          { header: data.focusMake, value: (r) => r.focus },
          { header: "Andel", value: (r) => Number(r.share) },
          { header: "El", value: (r) => r.emob },
          { header: "El-andel", value: (r) => Number(r.emobShare) },
          { header: "P10", value: (r) => r.p10 },
          { header: "P90", value: (r) => r.p90 },
        ],
      },
      {
        name: "TMF segmenter",
        rows: data.tmfSegmentForecast.map((row) => ({ ...row })),
        columns: [
          { header: "Segment", value: (r) => r.label },
          { header: "Marked", value: (r) => r.annualMarket },
          { header: data.focusMake, value: (r) => r.annualVolvo },
          { header: "Andel %", value: (r) => Number(r.volvoSharePct) },
          { header: "El %", value: (r) => Number(r.emobSharePct) },
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
