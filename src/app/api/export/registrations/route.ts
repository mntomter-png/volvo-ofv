import {
  getHpBucketLabel,
  getPabyggSegmentLabel,
  getRegionLabel,
} from "@/lib/ofv/segmentation";
import {
  csvResponse,
  exportFilename,
  toCsv,
  type CsvColumn,
} from "@/lib/export/csv";
import { parseRegistrationsSearchParams } from "@/lib/registrations/filters";
import {
  getAllRegistrationsForExport,
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

const COLUMNS: CsvColumn<RegistrationRow>[] = [
  { header: "Reg.nr", value: (r) => r.registration_number },
  { header: "Dato", value: (r) => formatDate(r.transaction_time) },
  { header: "Merke", value: (r) => r.make_name },
  { header: "Modell", value: (r) => r.model_name },
  { header: "OFV-segment", value: (r) => r.usage_name },
  { header: "Region", value: (r) => (r.sales_region != null ? getRegionLabel(r.sales_region) : null) },
  { header: "HK-bøtte", value: (r) => (r.hp_bucket != null ? getHpBucketLabel(r.hp_bucket) : null) },
  { header: "Drivstoff", value: (r) => r.fuel_name },
  { header: "Påbygg", value: (r) => (r.pabygg_segment ? getPabyggSegmentLabel(r.pabygg_segment) : null) },
  { header: "Totalvekt (kg)", value: (r) => r.maximum_laden_mass_kg },
  { header: "Eier", value: (r) => r.primary_owner_name },
  { header: "Eier postnr", value: (r) => r.primary_owner_postal_code },
  { header: "Eier poststed", value: (r) => r.primary_owner_postal_district },
  { header: "Bruker", value: (r) => r.primary_user_name },
  { header: "Bruker postnr", value: (r) => r.primary_user_postal_code },
  { header: "Bruker poststed", value: (r) => r.primary_user_postal_district },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseRegistrationsSearchParams(
    Object.fromEntries(searchParams.entries()),
  );

  const rows = await getAllRegistrationsForExport(filters);
  const csv = toCsv(rows, COLUMNS);

  return csvResponse(csv, exportFilename(`nyregistreringer-${filters.year}`));
}
