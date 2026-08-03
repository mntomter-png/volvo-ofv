import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import { requirePageAccess } from "@/lib/auth/roles";
import { displayVehicleModel } from "@/lib/format";
import {
  excelResponse,
  exportFilename,
  toExcelBuffer,
  type ExportColumn,
} from "@/lib/export/excel";
import { parsePopulationSearchParams } from "@/lib/population/filters";
import {
  getAllPopulationForExport,
  POPULATION_EXPORT_MAX_ROWS,
  type PopulationRow,
} from "@/lib/population/queries";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

const COLUMNS: ExportColumn<PopulationRow>[] = [
  { header: "Reg.nr", value: (r) => r.registration_number },
  { header: "Merke", value: (r) => r.make_name },
  { header: "Modell", value: (r) => displayVehicleModel(r.model_name, r.variant_name) },
  { header: "Variant", value: (r) => r.variant_name },
  { header: "OFV Usage", value: (r) => r.usage_name },
  { header: "Totalvekt (kg)", value: (r) => r.maximum_laden_mass_kg },
  { header: "Først registrert", value: (r) => formatDate(r.first_registration_date) },
  { header: "Status", value: (r) => r.vehicle_status },
  { header: "Eier", value: (r) => r.primary_owner_name },
  { header: "Eier postnr", value: (r) => r.primary_owner_postal_code },
  { header: "Eier poststed", value: (r) => r.primary_owner_postal_district },
  { header: "Bruker", value: (r) => r.primary_user_name },
  { header: "Bruker postnr", value: (r) => r.primary_user_postal_code },
  { header: "Bruker poststed", value: (r) => r.primary_user_postal_district },
];

export async function GET(request: Request) {
  const user = await requirePageAccess("populasjon");
  const limited = await assertExportRateLimit({
    request,
    userId: user.id,
    route: "population",
  });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const filters = parsePopulationSearchParams(
    Object.fromEntries(searchParams.entries()),
  );

  const { rows, truncated } = await getAllPopulationForExport(filters);
  const buffer = toExcelBuffer(rows, COLUMNS);

  const response = excelResponse(buffer, exportFilename("bestand"));
  if (truncated) {
    response.headers.set("X-Export-Truncated", "true");
    response.headers.set(
      "X-Export-Max-Rows",
      String(POPULATION_EXPORT_MAX_ROWS),
    );
  }
  return response;
}
