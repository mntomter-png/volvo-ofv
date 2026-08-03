import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import { requirePageAccess } from "@/lib/auth/roles";
import { displayVehicleModel } from "@/lib/format";
import {
  getBodyworkFilterLabel,
  getHpBucketLabel,
  getPabyggSegmentLabel,
  getRegionLabel,
} from "@/lib/ofv/segmentation";
import {
  excelResponse,
  exportFilename,
  toExcelBuffer,
  type ExportColumn,
} from "@/lib/export/excel";
import { parseRegistrationsSearchParams } from "@/lib/registrations/filters";
import {
  getAllRegistrationsForExport,
  REGISTRATIONS_EXPORT_MAX_ROWS,
  type RegistrationRow,
} from "@/lib/registrations/queries";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatBodywork(row: RegistrationRow): string | null {
  if (row.bodywork_code != null) return getBodyworkFilterLabel(row.bodywork_code);
  if (row.bodywork_name) return row.bodywork_name;
  return "Uten påbygg";
}

const COLUMNS: ExportColumn<RegistrationRow>[] = [
  { header: "Reg.nr", value: (r) => r.registration_number },
  { header: "Dato", value: (r) => formatDate(r.transaction_time) },
  { header: "Merke", value: (r) => r.make_name },
  { header: "Modell", value: (r) => displayVehicleModel(r.model_name, r.variant_name) },
  { header: "Variant", value: (r) => r.variant_name },
  { header: "Påbygg", value: (r) => (r.pabygg_segment ? getPabyggSegmentLabel(r.pabygg_segment) : null) },
  { header: "Påbygg-kode", value: (r) => formatBodywork(r) },
  { header: "OFV Usage", value: (r) => r.usage_name },
  { header: "Region", value: (r) => (r.sales_region != null ? getRegionLabel(r.sales_region) : null) },
  { header: "HK-bøtte", value: (r) => (r.hp_bucket != null ? getHpBucketLabel(r.hp_bucket) : null) },
  { header: "Drivstoff", value: (r) => r.fuel_name },
  { header: "Totalvekt (kg)", value: (r) => r.maximum_laden_mass_kg },
  { header: "Eier", value: (r) => r.primary_owner_name },
  { header: "Eier postnr", value: (r) => r.primary_owner_postal_code },
  { header: "Eier poststed", value: (r) => r.primary_owner_postal_district },
  { header: "Bruker", value: (r) => r.primary_user_name },
  { header: "Bruker postnr", value: (r) => r.primary_user_postal_code },
  { header: "Bruker poststed", value: (r) => r.primary_user_postal_district },
];

export async function GET(request: Request) {
  const user = await requirePageAccess("nyregistreringer");
  const limited = await assertExportRateLimit({
    request,
    userId: user.id,
    route: "registrations",
  });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const filters = parseRegistrationsSearchParams(
    Object.fromEntries(searchParams.entries()),
  );

  const { rows, truncated } = await getAllRegistrationsForExport(filters);
  const buffer = toExcelBuffer(rows, COLUMNS);

  const response = excelResponse(
    buffer,
    exportFilename(`nyregistreringer-${filters.year}`),
  );
  if (truncated) {
    response.headers.set("X-Export-Truncated", "true");
    response.headers.set(
      "X-Export-Max-Rows",
      String(REGISTRATIONS_EXPORT_MAX_ROWS),
    );
  }
  return response;
}
