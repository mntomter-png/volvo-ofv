import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import { requirePageAccess } from "@/lib/auth/roles";
import { getUserBrand } from "@/lib/brand/user-brand";
import {
  excelResponse,
  exportFilename,
  toExcelBuffer,
  type ExportColumn,
} from "@/lib/export/excel";
import { getHpBucketLabel, getRegionLabel } from "@/lib/ofv/segmentation";
import { parseRegistrationsSearchParams } from "@/lib/registrations/filters";
import {
  getPotentialTabData,
  type PotentialAccountRow,
} from "@/lib/registrations/potential-queries";
import { POPULATION_DISTRICTS } from "@/lib/ofv/segmentation";

const STATUS_LABEL: Record<string, string> = {
  untapped: "Aldri Volvo",
  competitor: "Kjøper konkurrent",
  mixed: "Volvo + konkurrent",
  due: "Byttetid 3–5 år",
  overdue: "Byttetid over 5 år",
};

const COLUMNS: ExportColumn<PotentialAccountRow>[] = [
  { header: "Bruker", value: (r) => r.partyName },
  { header: "Signal", value: (r) => STATUS_LABEL[r.status] ?? r.status },
  { header: "Score", value: (r) => r.potentialScore },
  { header: "Produktpassform", value: (r) => r.fitScore },
  { header: "Timing", value: (r) => r.timingScore },
  { header: "Størrelse", value: (r) => r.sizeScore },
  {
    header: "Region",
    value: (r) => (r.region != null ? getRegionLabel(r.region) : null),
  },
  { header: "Distrikt", value: (r) => r.district },
  { header: "Foreslått påbygg", value: (r) => r.recommendedBodyworkName },
  {
    header: "Foreslått HK",
    value: (r) =>
      r.recommendedHpBucket != null
        ? getHpBucketLabel(r.recommendedHpBucket)
        : null,
  },
  {
    header: "Drivlinje",
    value: (r) =>
      r.recommendedDriveline === "EMOB"
        ? "El"
        : r.recommendedDriveline === "ICE"
          ? "Diesel/ICE"
          : r.recommendedDriveline,
  },
  { header: "År siden Volvo", value: (r) => r.yearsSinceLast },
  { header: "Siste Volvo-dato", value: (r) => r.lastFocusDate },
  { header: "Flåte fokus", value: (r) => r.fleetFocus },
  { header: "Flåte totalt", value: (r) => r.fleetTotal },
  { header: "Konkurrent i perioden", value: (r) => r.competitorUnits },
  { header: "Fokus i perioden", value: (r) => r.currentFocus },
  { header: "Sterke påbygg (10 år)", value: (r) => r.strongBodyworkUnits },
];

export async function GET(request: Request) {
  try {
    const user = await requirePageAccess("nyregistreringer");
    const limited = await assertExportRateLimit({
      request,
      userId: user.id,
      route: "potential",
    });
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const filters = parseRegistrationsSearchParams(params);
    const brand = getUserBrand(user);
    const excludeFinance =
      params.excludeFinance !== "0" && params.excludeFinance !== "false";
    const districtRaw = params.district;
    const district =
      districtRaw && POPULATION_DISTRICTS.has(districtRaw)
        ? districtRaw
        : null;

    const data = await getPotentialTabData(
      filters,
      brand.makeName,
      excludeFinance,
      district,
    );

    if (data.error) {
      return new Response(data.error, { status: 500 });
    }

    return excelResponse(
      toExcelBuffer(data.rows, COLUMNS),
      exportFilename(`potensial-${filters.year}`),
    );
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
