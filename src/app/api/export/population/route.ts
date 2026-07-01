import {
  excelResponse,
  exportFilename,
  toExcelBuffer,
  type ExportColumn,
} from "@/lib/export/excel";
import { parsePopulationSearchParams } from "@/lib/population/filters";
import {
  getAllPopulationForExport,
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
  { header: "Modell", value: (r) => r.model_name },
  { header: "Variant", value: (r) => r.variant_name },
  { header: "Segment", value: (r) => r.usage_name },
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
  const { searchParams } = new URL(request.url);
  const filters = parsePopulationSearchParams(
    Object.fromEntries(searchParams.entries()),
  );

  const rows = await getAllPopulationForExport(filters);
  const buffer = toExcelBuffer(rows, COLUMNS);

  return excelResponse(buffer, exportFilename("bestand"));
}
