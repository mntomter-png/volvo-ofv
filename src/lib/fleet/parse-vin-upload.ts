import * as XLSX from "xlsx";

import {
  buildFleetVinSetFromChassisSheet,
  FLEET_DEALER_CODE,
  normalizeDealerCode,
  normalizeVin,
} from "@/lib/fleet";

export interface FleetVinParseResult {
  vins: string[];
  skippedInvalid: number;
  source: "vin_column" | "chassis_hierarchy";
}

function findHeaderIndex(headers: unknown[], pattern: RegExp): number {
  return headers.findIndex((header) =>
    pattern.test(String(header ?? "").toLowerCase()),
  );
}

function parseVinColumnSheet(rows: unknown[][]): string[] | null {
  if (rows.length < 1) return null;

  const headers = rows[0] ?? [];
  const vinCol = findHeaderIndex(headers, /\bvin\b/);
  const startRow = vinCol >= 0 ? 1 : 0;
  const column = vinCol >= 0 ? vinCol : 0;

  const vins: string[] = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const vin = normalizeVin(row[column]);
    if (vin) vins.push(vin);
  }

  return vins.length > 0 ? vins : null;
}

function parsePreprocessedChassisSheet(rows: unknown[][]): string[] | null {
  if (rows.length < 2) return null;

  const headers = rows[0] ?? [];
  const vinCol = findHeaderIndex(headers, /\bvin\b/);
  const dealerCol = findHeaderIndex(headers, /dealer\s*number/);
  if (vinCol < 0) return null;

  const vins: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (dealerCol >= 0 && normalizeDealerCode(row[dealerCol]) !== FLEET_DEALER_CODE) {
      continue;
    }
    const vin = normalizeVin(row[vinCol]);
    if (vin) vins.push(vin);
  }

  return vins.length > 0 ? vins : null;
}

function dedupeValidVins(vins: string[]): FleetVinParseResult {
  const unique = new Set<string>();
  let skippedInvalid = 0;

  for (const raw of vins) {
    const vin = normalizeVin(raw);
    if (!vin || vin.length < 11 || vin.length > 17) {
      skippedInvalid += 1;
      continue;
    }
    unique.add(vin);
  }

  return {
    vins: [...unique],
    skippedInvalid,
    source: "vin_column",
  };
}

/** Parser opplastet fil til normaliserte VIN-er. */
export function parseFleetVinUpload(buffer: ArrayBuffer): FleetVinParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName =
    wb.SheetNames.find((name) => name.toLowerCase().includes("chassis")) ??
    wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("Filen inneholder ingen ark.");
  }

  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Kunne ikke lese regnearket.");
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const vinColumn = parseVinColumnSheet(rows);
  if (vinColumn) {
    return {
      ...dedupeValidVins(vinColumn),
      source: "vin_column",
    };
  }

  const preprocessed = parsePreprocessedChassisSheet(rows);
  if (preprocessed) {
    return {
      ...dedupeValidVins(preprocessed),
      source: "chassis_hierarchy",
    };
  }

  const chassisVins = buildFleetVinSetFromChassisSheet(rows);
  if (chassisVins.size > 0) {
    return {
      ...dedupeValidVins([...chassisVins]),
      source: "chassis_hierarchy",
    };
  }

  throw new Error(
    "Fant ingen gyldige VIN-er. Bruk en fil med VIN-kolonne, eller ChassisHierarchy med dealer 896.",
  );
}
