/** CSV-generering tilpasset norsk Excel (semikolon-separert + BOM). */

const DELIMITER = ";";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let str = String(value);

  // Excel kan tolke ledende +, -, =, @ som formler – prefiks med apostrof.
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes(DELIMITER) || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((col) => escapeCell(col.header)).join(DELIMITER);
  const lines = rows.map((row) =>
    columns.map((col) => escapeCell(col.value(row))).join(DELIMITER),
  );
  // BOM (\uFEFF) sikrer at Excel leser UTF-8 (æøå) korrekt.
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function exportFilename(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.csv`;
}
