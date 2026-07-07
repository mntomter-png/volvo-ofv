/**
 * Fleet VIN-filter (dealer 896) og flåtesegmentering per eier.
 * Logikk speilet fra Volvo-dashbord (docs/fleet-registrations/fleet.ts).
 */

import {
  classifyFleetSize,
  FLEET_EXCLUDED_PATTERNS,
  FLEET_INTERVALS,
  isExcludedFleetOwner,
} from "@/lib/ofv/segmentation";

export {
  classifyFleetSize,
  FLEET_EXCLUDED_PATTERNS,
  FLEET_INTERVALS,
  isExcludedFleetOwner,
};

// ─────────────────────────────────────────────────────────────────────────────
// Fleet VIN (ChassisHierarchy, dealer 896)
// ─────────────────────────────────────────────────────────────────────────────

export const FLEET_DEALER_CODE = "896";

export type FleetFilter = "all" | "region" | "fleet";

export const FLEET_FILTER_LABELS: Record<FleetFilter, string> = {
  all: "Alle",
  region: "Kun Region",
  fleet: "Kun Fleet Sales Norge",
};

export interface VolvoVinRecord {
  vin: string;
  postalCode: string;
}

export function normalizeVin(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function normalizeDealerCode(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const numeric = raw.replace(",", ".");
  const asNumber = Number(numeric);
  if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
    return String(Math.trunc(asNumber));
  }
  const match = raw.match(/\d+/);
  return match ? match[0] : raw;
}

function findHeaderIndex(headers: unknown[], pattern: RegExp): number {
  return headers.findIndex((header) =>
    pattern.test(String(header ?? "").toLowerCase()),
  );
}

export function extractFleetVinFromChassisRecord(
  record: Record<string, unknown>,
): string | null {
  let vin: unknown;
  let dealer: unknown;

  for (const [key, value] of Object.entries(record)) {
    const lower = key.toLowerCase();
    if (/\bvin\b/.test(lower)) vin = value;
    if (/dealer\s*number/.test(lower)) dealer = value;
  }

  if (normalizeDealerCode(dealer) !== FLEET_DEALER_CODE) return null;
  const normalized = normalizeVin(vin);
  return normalized || null;
}

export function buildFleetVinSetFromChassisRecords(
  records: Record<string, unknown>[],
): Set<string> {
  const vins = new Set<string>();
  for (const record of records) {
    const vin = extractFleetVinFromChassisRecord(record);
    if (vin) vins.add(vin);
  }
  return vins;
}

export function buildFleetVinSetFromChassisSheet(rows: unknown[][]): Set<string> {
  if (rows.length === 0) return new Set();

  const headers = rows[0] ?? [];
  const vinCol = findHeaderIndex(headers, /\bvin\b/);
  const dealerCol = findHeaderIndex(headers, /dealer\s*number/);
  if (vinCol < 0 || dealerCol < 0) return new Set();

  const vins = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (normalizeDealerCode(row[dealerCol]) !== FLEET_DEALER_CODE) continue;
    const vin = normalizeVin(row[vinCol]);
    if (vin) vins.add(vin);
  }
  return vins;
}

export function isFleetVin(vin: string, fleetVins: Set<string>): boolean {
  return fleetVins.has(normalizeVin(vin));
}

// ─────────────────────────────────────────────────────────────────────────────
// Markedsandel-filter (region / distrikt)
// ─────────────────────────────────────────────────────────────────────────────

export interface RegionBrandTotals {
  total: number;
  brands: Record<string, number>;
}

export interface TerritoryShareEntry {
  territory: string;
  region: string;
  totalUnits: number;
  brands: Array<{ brand: string; units: number; percentage?: number }>;
}

type PostalResolver = (
  postalCode: string,
) => { territory: string; region: string } | null;

export function countFleetVolvoByRegion(
  volvoVins: VolvoVinRecord[],
  fleetVins: Set<string>,
  resolvePostal: PostalResolver,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of volvoVins) {
    if (!isFleetVin(record.vin, fleetVins)) continue;
    const info = resolvePostal(record.postalCode);
    if (!info) continue;
    counts.set(info.region, (counts.get(info.region) ?? 0) + 1);
  }
  return counts;
}

export function countFleetVolvoByTerritory(
  volvoVins: VolvoVinRecord[],
  fleetVins: Set<string>,
  resolvePostal: PostalResolver,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of volvoVins) {
    if (!isFleetVin(record.vin, fleetVins)) continue;
    const info = resolvePostal(record.postalCode);
    if (!info) continue;
    counts.set(info.territory, (counts.get(info.territory) ?? 0) + 1);
  }
  return counts;
}

function recalcBrandPercentages(
  brands: TerritoryShareEntry["brands"],
  totalUnits: number,
): TerritoryShareEntry["brands"] {
  return brands.map((brand) => ({
    ...brand,
    percentage:
      totalUnits > 0 ? (brand.units / totalUnits) * 100 : 0,
  }));
}

export function applyFleetFilterToRegionTotals(
  regionMap: Map<string, RegionBrandTotals>,
  fleetFilter: FleetFilter,
  fleetByRegion: Map<string, number>,
): void {
  if (fleetFilter === "all") return;

  for (const [region, totals] of regionMap.entries()) {
    const fleetCount = fleetByRegion.get(region) ?? 0;
    if (fleetFilter === "region") {
      const volvoUnits = totals.brands.Volvo ?? 0;
      const adjustedVolvo = Math.max(0, volvoUnits - fleetCount);
      totals.brands.Volvo = adjustedVolvo;
      totals.total = Math.max(0, totals.total - fleetCount);
      continue;
    }

    totals.brands = { Volvo: fleetCount };
    totals.total = fleetCount;
  }
}

export function applyFleetFilterToTerritoryShare(
  entry: TerritoryShareEntry,
  fleetFilter: FleetFilter,
  fleetCount: number,
): TerritoryShareEntry {
  if (fleetFilter === "all") return entry;

  if (fleetFilter === "region") {
    const volvoBrand = entry.brands.find((b) => b.brand === "Volvo");
    const volvoUnits = volvoBrand?.units ?? 0;
    const adjustedVolvo = Math.max(0, volvoUnits - fleetCount);
    const adjustedTotal = Math.max(0, entry.totalUnits - fleetCount);
    const brands = entry.brands.map((brand) =>
      brand.brand === "Volvo"
        ? { ...brand, units: adjustedVolvo }
        : { ...brand },
    );
    return {
      ...entry,
      totalUnits: adjustedTotal,
      brands: recalcBrandPercentages(brands, adjustedTotal),
    };
  }

  const brands = [{ brand: "Volvo", units: fleetCount, percentage: 100 }];
  return {
    ...entry,
    totalUnits: fleetCount,
    brands,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Flåtesegmentering (antall enheter per eier)
// ─────────────────────────────────────────────────────────────────────────────

export interface FleetExcelRow {
  date: Date | null;
  brand: string;
  user: string;
  postalCode: string;
  horsepower: string;
  pabygg: string;
}

export interface FleetApiRegistration {
  bruker: string;
  orgNr: string;
  postalCode: string;
  totalUnits: number;
  brands: Array<{ brand: string; units: number }>;
}

export interface FleetIntervalRow {
  interval: string;
  owners: number;
  units: number;
  volvoUnits: number;
}

export interface FleetSegmentationResult {
  intervalData: FleetIntervalRow[];
  totalOwners: number;
  totalUnits: number;
  volvoUnits: number;
  excludedOwners: number;
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSXDateToJS(value);
    return parsed;
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function XLSXDateToJS(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
}

function findSheetColumnIndex(headers: unknown[], names: string[]): number {
  const normalized = names.map((name) => name.toLowerCase());
  return headers.findIndex((header) => {
    const lower = String(header ?? "").toLowerCase().trim();
    return normalized.some((name) => lower === name || lower.includes(name));
  });
}

export function parseFleetRegistrationSheet(rows: unknown[][]): FleetExcelRow[] {
  if (rows.length < 2) return [];

  const headers = rows[0] ?? [];
  const dateCol = findSheetColumnIndex(headers, ["dato"]);
  const brandCol = findSheetColumnIndex(headers, ["merke"]);
  const userCol = findSheetColumnIndex(headers, ["bruker"]);
  const postalCol = findSheetColumnIndex(headers, ["bruker postnr", "postnr"]);
  const hpCol = findSheetColumnIndex(headers, ["motoreffekt"]);
  const pabyggCol = findSheetColumnIndex(headers, ["påbygg", "pabygg"]);

  if (userCol < 0) return [];

  const parsed: FleetExcelRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const user = String(row[userCol] ?? "").trim();
    if (!user) continue;

    parsed.push({
      date: dateCol >= 0 ? parseExcelDate(row[dateCol]) : null,
      brand: brandCol >= 0 ? String(row[brandCol] ?? "").trim() : "",
      user,
      postalCode: postalCol >= 0 ? String(row[postalCol] ?? "").trim() : "",
      horsepower: hpCol >= 0 ? String(row[hpCol] ?? "").trim() : "",
      pabygg: pabyggCol >= 0 ? String(row[pabyggCol] ?? "").trim() : "",
    });
  }
  return parsed;
}

function isVolvoBrand(brand: string): boolean {
  return brand.toLowerCase().includes("volvo");
}

function ownerKey(name: string, orgNr?: string): string {
  const org = String(orgNr ?? "").trim();
  return org || name.trim().toLowerCase();
}

interface OwnerAggregate {
  name: string;
  postalCode: string;
  units: number;
  volvoUnits: number;
}

function passesGeoFilter(
  postalCode: string,
  selectedRegion: string,
  selectedTerritory: string,
  resolvePostal: PostalResolver,
): boolean {
  if (selectedRegion === "all" && selectedTerritory === "all") return true;
  const info = resolvePostal(postalCode);
  if (!info) return false;
  if (selectedTerritory !== "all" && info.territory !== selectedTerritory) {
    return false;
  }
  if (selectedRegion !== "all" && info.region !== selectedRegion) {
    return false;
  }
  return true;
}

export function aggregateFleetSegmentation(opts: {
  excelRows: FleetExcelRow[];
  apiRegistrations: FleetApiRegistration[];
  apiYear: number;
  selectedRegion?: string;
  selectedTerritory?: string;
  resolvePostal: PostalResolver;
}): FleetSegmentationResult {
  const {
    excelRows,
    apiRegistrations,
    selectedRegion = "all",
    selectedTerritory = "all",
    resolvePostal,
  } = opts;

  const owners = new Map<string, OwnerAggregate>();
  let excludedOwners = 0;
  const excludedSeen = new Set<string>();

  const addOwnerUnits = (
    name: string,
    orgNr: string | undefined,
    postalCode: string,
    units: number,
    volvoUnits: number,
  ) => {
    if (!name.trim()) return;
    if (isExcludedFleetOwner(name)) {
      const key = ownerKey(name, orgNr);
      if (!excludedSeen.has(key)) {
        excludedSeen.add(key);
        excludedOwners += 1;
      }
      return;
    }
    if (
      !passesGeoFilter(postalCode, selectedRegion, selectedTerritory, resolvePostal)
    ) {
      return;
    }

    const key = ownerKey(name, orgNr);
    const existing = owners.get(key);
    if (existing) {
      existing.units += units;
      existing.volvoUnits += volvoUnits;
      if (!existing.postalCode && postalCode) existing.postalCode = postalCode;
      return;
    }
    owners.set(key, {
      name: name.trim(),
      postalCode,
      units,
      volvoUnits,
    });
  };

  for (const row of excelRows) {
    addOwnerUnits(row.user, undefined, row.postalCode, 1, isVolvoBrand(row.brand) ? 1 : 0);
  }

  for (const registration of apiRegistrations) {
    const volvoUnits = registration.brands
      .filter((brand) => isVolvoBrand(brand.brand))
      .reduce((sum, brand) => sum + brand.units, 0);
    addOwnerUnits(
      registration.bruker,
      registration.orgNr,
      registration.postalCode,
      registration.totalUnits,
      volvoUnits,
    );
  }

  const intervalMap = new Map<string, FleetIntervalRow>();
  for (const interval of FLEET_INTERVALS) {
    intervalMap.set(interval.label, {
      interval: interval.label,
      owners: 0,
      units: 0,
      volvoUnits: 0,
    });
  }

  let totalUnits = 0;
  let volvoUnits = 0;

  for (const owner of owners.values()) {
    const bucket = classifyFleetSize(owner.units);
    if (!bucket) continue;
    const row = intervalMap.get(bucket);
    if (!row) continue;
    row.owners += 1;
    row.units += owner.units;
    row.volvoUnits += owner.volvoUnits;
    totalUnits += owner.units;
    volvoUnits += owner.volvoUnits;
  }

  return {
    intervalData: FLEET_INTERVALS.map(
      (interval) =>
        intervalMap.get(interval.label) ?? {
          interval: interval.label,
          owners: 0,
          units: 0,
          volvoUnits: 0,
        },
    ),
    totalOwners: owners.size,
    totalUnits,
    volvoUnits,
    excludedOwners,
  };
}
