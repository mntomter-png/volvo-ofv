import * as XLSX from "xlsx";

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** Tegn som gjør hele .xlsx-filen uleselig i Excel (OpenXML forbyr dem). */
const ILLEGAL_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Hindrer formelinjeksjon når filen åpnes i Excel/LibreOffice. */
function sanitizeSpreadsheetString(value: string): string {
  const stripped = value.replace(ILLEGAL_XML_CHARS, "");
  if (/^[=+\-@\t\r]/.test(stripped)) {
    return `'${stripped}`;
  }
  return stripped;
}

/**
 * Komprimering holder filtrerte eksporter nede. Hele bestanden er fortsatt
 * større enn Netlify sin synkrone grense på 6 MB og leveres fra Storage.
 */
const WRITE_OPTIONS: XLSX.WritingOptions = {
  type: "buffer",
  bookType: "xlsx",
  compression: true,
};

function cellValue(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return sanitizeSpreadsheetString(String(value));
}

export function toExcelBuffer<T>(rows: T[], columns: ExportColumn<T>[]): Buffer {
  const data: (string | number)[][] = [
    columns.map((col) => col.header),
    ...rows.map((row) => columns.map((col) => cellValue(col.value(row)))),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

  return XLSX.write(workbook, WRITE_OPTIONS) as Buffer;
}

export interface ExcelSheet<T> {
  name: string;
  rows: T[];
  columns: ExportColumn<T>[];
}

export function toExcelWorkbookBuffer(sheets: ExcelSheet<unknown>[]): Buffer {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const data: (string | number)[][] = [
      sheet.columns.map((col) => col.header),
      ...sheet.rows.map((row) =>
        sheet.columns.map((col) => cellValue(col.value(row))),
      ),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  return XLSX.write(workbook, WRITE_OPTIONS) as Buffer;
}

export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function exportFilename(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.xlsx`;
}
