import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import {
  apiErrorResponse,
  requireApiPageAccess,
} from "@/lib/auth/api-access";
import { getUserBrand } from "@/lib/brand/user-brand";
import {
  excelResponse,
  exportFilename,
  toExcelWorkbookBuffer,
  type ExcelSheet,
  type ExportColumn,
} from "@/lib/export/excel";
import { parsePkkSearchParams } from "@/lib/pkk/filters";
import { fetchPkkCustomerNotesForUser } from "@/lib/pkk/note-actions";
import {
  formatPkkExportPriority,
  formatPkkExportRegion,
  getPkkExportData,
  PKK_EXPORT_VEHICLE_LIMIT,
  type PkkCustomerRow,
  type PkkExportVehicleRow,
} from "@/lib/pkk/queries";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

const CUSTOMER_COLUMNS: ExportColumn<PkkCustomerRow>[] = [
  { header: "Prioritet", value: (r) => formatPkkExportPriority(r) },
  { header: "Kunde", value: (r) => r.owner_name },
  { header: "Org.nr.", value: (r) => r.owner_orgnr },
  { header: "Sted", value: (r) => r.owner_location },
  { header: "Region", value: (r) => formatPkkExportRegion(r.sales_region) },
  { header: "Distrikt", value: (r) => r.sales_district ?? "" },
  { header: "Flåte", value: (r) => r.focus_count },
  { header: "Forfalt", value: (r) => r.overdue_count },
  { header: "≤ 30 d.", value: (r) => r.due_30_count },
  { header: "≤ 90 d.", value: (r) => r.due_90_count },
  { header: "≤ 6 mnd.", value: (r) => r.due_180_count },
  { header: "Nærmeste frist", value: (r) => formatDate(r.next_deadline) },
  { header: "Dager til frist", value: (r) => r.days_to_next },
];

const VEHICLE_COLUMNS: ExportColumn<PkkExportVehicleRow>[] = [
  { header: "Kunde", value: (r) => r.owner_name },
  { header: "Org.nr.", value: (r) => r.owner_orgnr },
  { header: "Reg.nr.", value: (r) => r.registration_number },
  { header: "Modell", value: (r) => r.model_name },
  { header: "Siste PKK", value: (r) => formatDate(r.pkk_last_date) },
  { header: "Neste frist", value: (r) => formatDate(r.pkk_next_deadline) },
  { header: "Dager til frist", value: (r) => r.days_until_due },
];

export async function GET(request: Request) {
  try {
    const user = await requireApiPageAccess("pkk");
    const limited = await assertExportRateLimit({
      request,
      userId: user.id,
      route: "pkk",
    });
    if (limited) return limited;
    const focusMake = getUserBrand(user).makeName;

    const { searchParams } = new URL(request.url);
    const filters = parsePkkSearchParams(
      Object.fromEntries(searchParams.entries()),
    );

    const [{ customers, vehicles }, notes] = await Promise.all([
      getPkkExportData(filters, focusMake),
      fetchPkkCustomerNotesForUser(user.id),
    ]);

    const customerColumns: ExportColumn<PkkCustomerRow>[] = [
      ...CUSTOMER_COLUMNS,
      {
        header: "Kontakt e-post",
        value: (r) => notes[r.owner_key]?.contactEmail ?? "",
      },
      {
        header: "Notat",
        value: (r) => notes[r.owner_key]?.note ?? "",
      },
    ];

    const sheets: ExcelSheet<unknown>[] = [
      {
        name: "Kunder",
        rows: customers,
        columns: customerColumns as ExportColumn<unknown>[],
      },
      {
        name: "Kjøretøy",
        rows: vehicles,
        columns: VEHICLE_COLUMNS as ExportColumn<unknown>[],
      },
    ];
    const buffer = toExcelWorkbookBuffer(sheets);

    const response = excelResponse(buffer, exportFilename("pkk-oppfolging"));
    if (vehicles.length >= PKK_EXPORT_VEHICLE_LIMIT) {
      response.headers.set("X-Export-Truncated", "true");
      response.headers.set(
        "X-Export-Max-Rows",
        String(PKK_EXPORT_VEHICLE_LIMIT),
      );
    }
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
