import * as XLSX from "xlsx";

import {
  FLEET_DEALER_CODES,
  fleetChassisLabel,
  fleetMatchKeyFromChassis,
  normalizeDealerCode,
  normalizeVin,
} from "@/lib/fleet";

export interface FleetVinParseResult {
  vins: string[];
  chassis: string[];
  skippedInvalid: number;
  skippedDealer: number;
  dealerFilterApplied: boolean;
  source: "vin_column" | "chassis_column" | "chassis_hierarchy";
}

export interface ParseFleetUploadOptions {
  /**
   * null = ikke filtrer på forhandler.
   * Utelatt = dealer 896 og 890.
   */
  dealerCodes?: string[] | null;
}

function findHeaderIndex(headers: unknown[], pattern: RegExp): number {
  return headers.findIndex((header) =>
    pattern.test(String(header ?? "").toLowerCase()),
  );
}

function findDealerColumn(headers: unknown[]): number {
  const labels = headers.map((header) =>
    String(header ?? "").toLowerCase().trim(),
  );
  const patterns = [
    /^dealer\s*id$/,
    /^dealer\s*number$/,
    /^dealer\s*(no|nr|code)$/,
    /^forhandler(nummer|nr|kode)?$/,
    /^dealer$/,
  ];
  for (const pattern of patterns) {
    const index = labels.findIndex((label) => pattern.test(label));
    if (index >= 0) return index;
  }
  return labels.findIndex(
    (label) =>
      /dealer\s*(id|number|no|nr)|forhandlernummer/.test(label) &&
      !/owner|city|group|name|eier/.test(label),
  );
}

function findChassisColumn(headers: unknown[]): number {
  return headers.findIndex((header) => {
    const label = String(header ?? "").toLowerCase();
    return /chassis|understell/.test(label) && !/\bvin\b/.test(label);
  });
}

function resolveDealerCodes(dealerCodes: string[] | null | undefined): string[] | null {
  if (dealerCodes === null) return null;
  if (dealerCodes === undefined) return [...FLEET_DEALER_CODES];
  return dealerCodes.length > 0 ? dealerCodes : null;
}

function dealerAllowed(
  value: unknown,
  dealerCodes: string[] | null,
  hasDealerColumn: boolean,
): boolean {
  if (!hasDealerColumn || dealerCodes == null) return true;
  return dealerCodes.includes(normalizeDealerCode(value));
}

function emptyResult(
  source: FleetVinParseResult["source"],
  dealerFilterApplied: boolean,
): FleetVinParseResult {
  return {
    vins: [],
    chassis: [],
    skippedInvalid: 0,
    skippedDealer: 0,
    dealerFilterApplied,
    source,
  };
}

function parseRows(
  rows: unknown[][],
  startRow: number,
  columns: { chassisCol: number; vinCol: number; dealerCol: number },
  dealerCodes: string[] | null,
  source: FleetVinParseResult["source"],
): FleetVinParseResult {
  const vins = new Set<string>();
  const chassis = new Set<string>();
  let skippedInvalid = 0;
  let skippedDealer = 0;
  const dealerFilterApplied = columns.dealerCol >= 0 && dealerCodes != null;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawChassis = columns.chassisCol >= 0 ? row[columns.chassisCol] : undefined;
    const rawVin = columns.vinCol >= 0 ? row[columns.vinCol] : undefined;
    const chassisBlank = String(rawChassis ?? "").trim() === "";
    const vinBlank = String(rawVin ?? "").trim() === "";
    if (chassisBlank && vinBlank) continue;

    if (!dealerAllowed(row[columns.dealerCol], dealerCodes, columns.dealerCol >= 0)) {
      skippedDealer += 1;
      continue;
    }

    let kept = false;
    if (!chassisBlank && fleetMatchKeyFromChassis(rawChassis)) {
      const label = fleetChassisLabel(rawChassis);
      if (label) {
        chassis.add(label);
        kept = true;
      }
    }
    if (!vinBlank) {
      const vin = normalizeVin(rawVin);
      if (vin.length >= 11 && vin.length <= 17) {
        vins.add(vin);
        kept = true;
      }
    }
    if (!kept) skippedInvalid += 1;
  }

  return {
    vins: [...vins],
    chassis: [...chassis],
    skippedInvalid,
    skippedDealer,
    dealerFilterApplied,
    source,
  };
}

function headerlessLooksLikeChassis(rows: unknown[][]): boolean {
  let chassis = 0;
  let vins = 0;
  const sample = rows.slice(0, 30);
  for (const row of sample) {
    const cell = row?.[0];
    if (String(cell ?? "").trim() === "") continue;
    if (fleetMatchKeyFromChassis(cell)) chassis += 1;
    else if (normalizeVin(cell).length >= 11) vins += 1;
  }
  return chassis > 0 && chassis > vins;
}

function parseVinColumnOnly(rows: unknown[][]): FleetVinParseResult {
  if (rows.length < 1) {
    return emptyResult("vin_column", false);
  }

  const headers = rows[0] ?? [];
  const vinCol = findHeaderIndex(headers, /\bvin\b/);
  const startRow = vinCol >= 0 ? 1 : 0;
  const column = vinCol >= 0 ? vinCol : 0;
  return parseRows(
    rows,
    startRow,
    { chassisCol: -1, vinCol: column, dealerCol: -1 },
    null,
    "vin_column",
  );
}

/** Parser opplastet fil til VIN-er og/eller chassisnummer. */
export function parseFleetVinUpload(
  buffer: ArrayBuffer,
  options?: ParseFleetUploadOptions,
): FleetVinParseResult {
  const dealerCodes = resolveDealerCodes(options?.dealerCodes);
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

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
  }) as unknown[][];

  if (rows.length === 0) {
    throw new Error("Filen inneholder ingen rader.");
  }

  const headers = rows[0] ?? [];
  const chassisCol = findChassisColumn(headers);
  const vinCol = findHeaderIndex(headers, /\bvin\b/);
  const dealerCol = findDealerColumn(headers);

  if (chassisCol >= 0 || (vinCol >= 0 && dealerCol >= 0)) {
    const parsed = parseRows(
      rows,
      1,
      { chassisCol, vinCol, dealerCol },
      dealerCodes,
      chassisCol >= 0 ? "chassis_column" : "chassis_hierarchy",
    );
    if (
      parsed.vins.length > 0 ||
      parsed.chassis.length > 0 ||
      parsed.skippedDealer > 0 ||
      parsed.skippedInvalid > 0
    ) {
      return parsed;
    }
  }

  if (chassisCol < 0 && vinCol < 0 && headerlessLooksLikeChassis(rows)) {
    return parseRows(
      rows,
      0,
      { chassisCol: 0, vinCol: -1, dealerCol: -1 },
      null,
      "chassis_column",
    );
  }

  const vinsOnly = parseVinColumnOnly(rows);
  if (vinsOnly.vins.length > 0) return vinsOnly;

  throw new Error(
    "Fant ingen gyldige chassisnummer eller VIN-er. Bruk Volvos fleet-liste med chassisnummer, eller en fil med VIN.",
  );
}
