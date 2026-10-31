import { toExcelBuffer, type ExportColumn } from "@/lib/export/excel";
import { buildStreamingXlsx } from "@/lib/export/streaming-xlsx";
import { displayVehicleModel } from "@/lib/format";
import type { PopulationExportRow } from "@/lib/population/export-shared";

const EXPORT_DATE = new Intl.DateTimeFormat("nb-NO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatExportDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return EXPORT_DATE.format(date);
}

export const POPULATION_EXPORT_COLUMNS: ExportColumn<PopulationExportRow>[] = [
  { header: "Reg.nr", value: (row) => row.registration_number },
  { header: "Merke", value: (row) => row.make_name },
  {
    header: "Modell",
    value: (row) => displayVehicleModel(row.model_name, row.variant_name),
  },
  { header: "Variant", value: (row) => row.variant_name },
  { header: "OFV Usage", value: (row) => row.usage_name },
  { header: "Totalvekt (kg)", value: (row) => row.maximum_laden_mass_kg },
  {
    header: "Først registrert",
    value: (row) => formatExportDate(row.first_registration_date),
  },
  { header: "Status", value: (row) => row.vehicle_status },
  { header: "Eier", value: (row) => row.primary_owner_name },
  { header: "Eier postnr", value: (row) => row.primary_owner_postal_code },
  { header: "Eier poststed", value: (row) => row.primary_owner_postal_district },
  { header: "Bruker", value: (row) => row.primary_user_name },
  { header: "Bruker postnr", value: (row) => row.primary_user_postal_code },
  {
    header: "Bruker poststed",
    value: (row) => row.primary_user_postal_district,
  },
];

export function populationRowsToExcel(rows: PopulationExportRow[]): Uint8Array {
  return toExcelBuffer(rows, POPULATION_EXPORT_COLUMNS);
}

/** Hele bestanden. Holder ikke alle radene i minnet samtidig. */
export async function buildPopulationStreamingXlsx(
  writeRows: (write: (row: PopulationExportRow) => Promise<void>) => Promise<void>,
): Promise<Buffer> {
  return buildStreamingXlsx({
    columns: POPULATION_EXPORT_COLUMNS,
    writeRows,
  });
}
