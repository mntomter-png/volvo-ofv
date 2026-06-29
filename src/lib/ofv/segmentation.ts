/**
 * OFV segmentering – TypeScript-modul for volvo-ofv
 *
 * Opprinnelig kopiert fra dashbord-prosjektet (synkronisert med
 * OFV_SEGMENTERING_TEKNISK_REFERANSE.md). Tilpasset volvo-ofv ved at
 * vekt-/transaksjonskonstantene gjenbrukes fra src/lib/ofv/constants.ts
 * for å unngå duplisert sannhet.
 */

import {
  HEAVY_TRUCK_MIN_KG,
  OFV_TRANSACTION_NEW_REGISTRATION,
} from "@/lib/ofv/constants";

// ─────────────────────────────────────────────────────────────────────────────
// 1. OFV API – defaults og konstanter
// ─────────────────────────────────────────────────────────────────────────────

export const OFV_BASE_URL = "https://integrasjon-ofv.qanto.no";

/** Standard kjøretøygruppe for tunge lastebiler */
export const DEFAULT_VEHICLE_GROUP = "N3";

/** N3 mappes til OFV authority vehicle type-kode "13" */
export const N3_AUTHORITY_VEHICLE_TYPE_CODE = "13";

/**
 * Minimum totalvekt for N3-analyse (16 tonn).
 * Alias for prosjektets felles konstant – ingen duplisert sannhet.
 */
export const DEFAULT_MIN_WEIGHT_KG = HEAVY_TRUCK_MIN_KG;

/**
 * 10 = førstegangsregistrerte nye.
 * Alias for prosjektets felles konstant – ingen duplisert sannhet.
 */
export const DEFAULT_TRANSACTION_TYPE_ID = OFV_TRANSACTION_NEW_REGISTRATION;

export type MotorFilter = "all" | "ICE" | "EMOB";

/** kW → HK (brukes når kun elektrisk/kW er tilgjengelig, eller som supplement) */
export const KW_TO_HP_FACTOR = 1.341;

export function getAuthorityVehicleTypeCodes(vehicleGroup: string = DEFAULT_VEHICLE_GROUP): string[] {
  const normalized = vehicleGroup.trim().toUpperCase();
  if (normalized === "N3") return [N3_AUTHORITY_VEHICLE_TYPE_CODE];
  return [vehicleGroup];
}

/** OFV Field-enum-felt som alltid bør forespørres */
export const OFV_BASE_FIELDS = [
  "Make",
  "TransactionType",
  "MaximumLadenMassKg",
  "AuthorityVehicleType_Code",
] as const;

/** OFV Field-enum-felt per analyse-type */
export const OFV_OPTIONAL_FIELDS = {
  regional: ["PrimaryUser_PostalCode", "VehicleIdentificationNumber"],
  bodywork: [
    "AdditionalBodyworks",
    "Bodywork_Code",
    "PrimaryUser_PostalCode",
    "EnginePowerHp",
    "TotalCylinderCapacityCm3",
    "CertificateVariantDesignation",
    "FirstRegistrationDate",
  ],
  bodyworkVehicles: ["VehicleIdentificationNumber", "RegistrationNumber", "PrimaryOwner_DisplayName"],
  hp: ["EnginePowerHp"],
  displacement: ["TotalCylinderCapacityCm3"],
  emob: ["ElectricEnginePowerKw"],
  model: ["CertificateVariantDesignation"],
  fleet: ["PrimaryOwner_DisplayName", "PrimaryOwner_Company_CompanyRegistrationNumber"],
  age: ["FirstRegistrationDate"],
} as const;

// Vektfeltkandidater (i prioritert rekkefølge) fra OFV-respons
const WEIGHT_FIELD_CANDIDATES = [
  "technicallyPermissibleMaximumLadenMassKg",
  "TechnicallyPermissibleMaximumLadenMassKg",
  "maximumLadenMassKg",
  "MaximumLadenMassKg",
  "maximumCombinationMassKg",
  "MaximumCombinationMassKg",
  "unladenMassKg",
  "UnladenMassKg",
  "massInRunningOrderKg",
  "MassInRunningOrderKg",
  "technicalPermittedMaxMassWithoutTrailer",
  "TechnicalPermittedMaxMassWithoutTrailer",
  "technicalPermittedMaxMass",
  "TechnicalPermittedMaxMass",
  "totalWeight",
  "TotalWeight",
  "grossVehicleWeight",
  "GrossVehicleWeight",
  "weight",
  "Weight",
] as const;

function coerceNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const v = rec.value ?? rec.amount;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

/** Hent totalvekt (kg) fra OFV-kjøretøyobjekt */
export function getWeightKgFromVehicle(vehicle: unknown): number {
  const rec = vehicle as Record<string, unknown>;
  const tx = (rec.transactions as Array<Record<string, unknown>> | undefined)?.[0];
  for (const key of WEIGHT_FIELD_CANDIDATES) {
    const n = coerceNumber(tx?.[key]);
    if (n > 0) return n;
  }
  for (const key of WEIGHT_FIELD_CANDIDATES) {
    const n = coerceNumber(rec[key]);
    if (n > 0) return n;
  }
  return 0;
}

export function passesMinWeightFilter(
  vehicle: unknown,
  minWeightKg: number = DEFAULT_MIN_WEIGHT_KG,
): boolean {
  const weightKg = getWeightKgFromVehicle(vehicle);
  return weightKg > 0 && weightKg >= minWeightKg;
}

export function isEmobVehicle(vehicle: unknown): boolean {
  const rec = vehicle as Record<string, unknown>;
  const tx = (rec.transactions as Array<Record<string, unknown>> | undefined)?.[0];
  const kw =
    coerceNumber(tx?.electricEnginePowerKw ?? tx?.ElectricEnginePowerKw) ||
    coerceNumber(rec.electricEnginePowerKw ?? rec.ElectricEnginePowerKw);
  return kw > 0;
}

export function passesMotorFilter(
  vehicle: unknown,
  motorFilter: MotorFilter = "all",
): boolean {
  if (motorFilter === "all") return true;
  const emob = isEmobVehicle(vehicle);
  if (motorFilter === "EMOB") return emob;
  if (motorFilter === "ICE") return !emob;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Merkegruppering
// ─────────────────────────────────────────────────────────────────────────────

export const NAMED_BRANDS = ["Volvo", "Scania", "Mercedes-Benz", "MAN", "Renault"] as const;
export type NamedBrand = (typeof NAMED_BRANDS)[number];
export type BrandGroup = NamedBrand | "Andre";
export const ALL_BRAND_GROUPS: BrandGroup[] = [...NAMED_BRANDS, "Andre"];

/** Merker brukt i OFV Edge Function-filtrering */
export const HEAVY_TRUCK_BRANDS = new Set([
  "volvo",
  "scania",
  "mercedes-benz",
  "man",
  "daf",
  "iveco",
  "renault trucks",
  "renault",
  "sany",
]);

export function normalizeBrand(brand: string): BrandGroup {
  const lower = brand.toLowerCase();
  if (lower.includes("volvo")) return "Volvo";
  if (lower.includes("scania")) return "Scania";
  if (lower.includes("mercedes")) return "Mercedes-Benz";
  if (lower === "man") return "MAN";
  if (lower.includes("renault")) return "Renault";
  return "Andre";
}

export function isHeavyTruckBrand(brand: string): boolean {
  const lower = brand.toLowerCase().trim();
  if (HEAVY_TRUCK_BRANDS.has(lower)) return true;
  for (const b of HEAVY_TRUCK_BRANDS) {
    if (lower.includes(b)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Regioner og distrikt
// ─────────────────────────────────────────────────────────────────────────────

export interface TerritoryInfo {
  territory: string;
  region: string;
}

export const ALL_TERRITORIES = [
  "Oslo", "Jessheim", "Asker og Bærum", "Drammen", "Gjøvik", "Hønefoss", "Lillehammer", "Follo",
  "Østfold", "Vestfold", "Telemark", "Grenland", "Buskerud", "Hamar", "Kongsvinger", "Kongsberg",
  "Kristiansand S", "Sandnes", "Bergen", "Haugesund", "Sandane",
  "Ålesund", "Molde", "Trondheim", "Steinkjer", "Namsos", "Mosjøen",
  "Bodø", "Narvik", "Svolvær", "Harstad", "Tromsø", "Finnsnes", "Alta", "Kirkenes",
] as const;

export type DealerTerritory = (typeof ALL_TERRITORIES)[number];

export const REGIONS = {
  "Region 1": ["Oslo", "Jessheim", "Asker og Bærum", "Drammen", "Gjøvik", "Hønefoss", "Lillehammer", "Follo"],
  "Region 2": ["Østfold", "Vestfold", "Telemark", "Grenland", "Buskerud", "Hamar", "Kongsvinger", "Kongsberg"],
  "Region 3": ["Kristiansand S", "Sandnes", "Bergen", "Haugesund", "Sandane"],
  "Region 4": ["Ålesund", "Molde", "Trondheim", "Steinkjer", "Namsos", "Mosjøen"],
  "Region 5": ["Bodø", "Narvik", "Svolvær", "Harstad", "Tromsø", "Finnsnes", "Alta", "Kirkenes"],
} as const;

export type SalesRegion = keyof typeof REGIONS;

export const REGION_OPTIONS = [
  { value: "Region 1", label: "Region 1 - Volvo Truck Center" },
  { value: "Region 2", label: "Region 2 - Volmax" },
  { value: "Region 3", label: "Region 3 - Trucknor" },
  { value: "Region 4", label: "Region 4 - Wist Last & Buss" },
  { value: "Region 5", label: "Region 5 - Nordic Last og Buss" },
] as const;

export const REGION_NAMES: Record<number, string> = {
  1: "Volvo Truck Center",
  2: "Volmax",
  3: "Trucknor",
  4: "Wist Last & Buss",
  5: "Nordic Last og Buss",
  9: "Volvo Norge, Direct Sales",
  10: "Volvo Norge",
};

export interface DistrictRange {
  from: number;
  to: number;
  district: string;
}

export const DISTRICT_RANGES: readonly DistrictRange[] = [
  { from: 0, to: 1295, district: "Oslo" },
  { from: 1300, to: 1399, district: "Asker og Bærum" },
  { from: 1400, to: 1460, district: "Follo" },
  { from: 1461, to: 1488, district: "Jessheim" },
  { from: 1489, to: 1539, district: "Follo" },
  { from: 1540, to: 1556, district: "Follo" },
  { from: 1900, to: 1971, district: "Jessheim" },
  { from: 2000, to: 2099, district: "Jessheim" },
  { from: 2100, to: 2134, district: "Kongsvinger" },
  { from: 2150, to: 2170, district: "Jessheim" },
  { from: 2600, to: 2609, district: "Lillehammer" },
  { from: 2610, to: 2610, district: "Hamar" },
  { from: 2611, to: 2611, district: "Lillehammer" },
  { from: 2612, to: 2612, district: "Hamar" },
  { from: 2613, to: 2615, district: "Lillehammer" },
  { from: 2616, to: 2616, district: "Hamar" },
  { from: 2617, to: 2699, district: "Lillehammer" },
  { from: 2800, to: 2899, district: "Gjøvik" },
  { from: 3000, to: 3069, district: "Drammen" },
  { from: 3070, to: 3074, district: "Vestfold" },
  { from: 3075, to: 3075, district: "Drammen" },
  { from: 3076, to: 3099, district: "Vestfold" },
  { from: 3400, to: 3499, district: "Drammen" },
  { from: 3500, to: 3543, district: "Hønefoss" },
  { from: 3544, to: 3544, district: "Buskerud" },
  { from: 3545, to: 3599, district: "Hønefoss" },
  { from: 1557, to: 1599, district: "Østfold" },
  { from: 1600, to: 1899, district: "Østfold" },
  { from: 1972, to: 1999, district: "Østfold" },
  { from: 2200, to: 2499, district: "Hamar" },
  { from: 2500, to: 2599, district: "Kongsvinger" },
  { from: 2700, to: 2710, district: "Kongsvinger" },
  { from: 2711, to: 2770, district: "Gjøvik" },
  { from: 2771, to: 2799, district: "Kongsvinger" },
  { from: 2900, to: 2985, district: "Gjøvik" },
  { from: 2986, to: 2999, district: "Kongsvinger" },
  { from: 3100, to: 3299, district: "Vestfold" },
  { from: 3300, to: 3399, district: "Buskerud" },
  { from: 3600, to: 3699, district: "Buskerud" },
  { from: 3700, to: 3999, district: "Telemark" },
  { from: 4000, to: 4399, district: "Sandnes" },
  { from: 4400, to: 4999, district: "Kristiansand S" },
  { from: 5000, to: 5499, district: "Bergen" },
  { from: 5500, to: 5699, district: "Haugesund" },
  { from: 5700, to: 5999, district: "Bergen" },
  { from: 6700, to: 6999, district: "Sandane" },
  { from: 6000, to: 6399, district: "Ålesund" },
  { from: 6400, to: 6699, district: "Molde" },
  { from: 7000, to: 7599, district: "Trondheim" },
  { from: 7600, to: 7799, district: "Steinkjer" },
  { from: 7800, to: 7999, district: "Namsos" },
  { from: 8600, to: 8899, district: "Mosjøen" },
  { from: 8000, to: 8299, district: "Bodø" },
  { from: 8300, to: 8499, district: "Svolvær" },
  { from: 8500, to: 8599, district: "Narvik" },
  { from: 8900, to: 8999, district: "Bodø" },
  { from: 9000, to: 9199, district: "Tromsø" },
  { from: 9200, to: 9399, district: "Finnsnes" },
  { from: 9400, to: 9499, district: "Harstad" },
  { from: 9500, to: 9599, district: "Alta" },
  { from: 9600, to: 9799, district: "Alta" },
  { from: 9800, to: 9999, district: "Kirkenes" },
] as const;

const TERRITORY_TO_REGION: Record<string, SalesRegion> = {};
for (const [region, territories] of Object.entries(REGIONS)) {
  for (const t of territories) {
    TERRITORY_TO_REGION[t] = region as SalesRegion;
  }
}

export function getTerritoryFromPostalCode(postalCode: string): string | null {
  if (!postalCode) return null;
  const code = parseInt(postalCode.trim(), 10);
  if (isNaN(code)) return null;
  for (const range of DISTRICT_RANGES) {
    if (code >= range.from && code <= range.to) return range.district;
  }
  return null;
}

export function getRegionFromTerritory(territory: string): SalesRegion | null {
  return TERRITORY_TO_REGION[territory] ?? null;
}

export function getRegionFromPostalCode(postalCode: string): SalesRegion | null {
  if (!postalCode) return null;

  const territory = getTerritoryFromPostalCode(postalCode);
  if (territory && TERRITORY_TO_REGION[territory]) {
    return TERRITORY_TO_REGION[territory];
  }

  const code = parseInt(postalCode.trim(), 10);
  if (isNaN(code)) return null;

  if (code < 1600) return "Region 1";
  if (code < 2000) return "Region 2";
  if (code < 2200) return "Region 1";
  if (code < 2600) return "Region 2";
  if (code < 2700) return "Region 1";
  if (code < 2800) return "Region 2";
  if (code < 2900) return "Region 1";
  if (code < 3000) return "Region 2";
  if (code < 3100) return "Region 1";
  if (code < 3500) return "Region 2";
  if (code < 3600) return "Region 1";
  if (code < 4000) return "Region 2";
  if (code < 6000) return "Region 3";
  if (code < 7000) return "Region 3";
  if (code < 8000) return "Region 4";
  if (code < 8600) return "Region 5";
  if (code < 8900) return "Region 4";
  return "Region 5";
}

export function getPostalCodeInfo(postalCode: string): TerritoryInfo | null {
  const territory = getTerritoryFromPostalCode(postalCode);
  if (!territory) return null;
  const region = getRegionFromTerritory(territory);
  if (!region) return null;
  return { territory, region };
}

export function getRegionFromDistrikt(distrikt: string): SalesRegion | null {
  if (!distrikt) return null;
  const d = distrikt.toLowerCase().trim();

  for (const [territory, region] of Object.entries(TERRITORY_TO_REGION)) {
    if (d.includes(territory.toLowerCase())) return region;
  }

  if (["østfold", "vestfold", "telemark", "grenland", "buskerud", "hamar", "kongsvinger", "kongsberg"].some((t) => d.includes(t))) {
    return "Region 2";
  }
  if (["stavanger", "rogaland", "hordaland", "agder"].some((t) => d.includes(t))) {
    return "Region 3";
  }
  if (["møre", "romsdal", "trøndelag"].some((t) => d.includes(t))) {
    return "Region 4";
  }
  if (["nordland", "troms", "finnmark"].some((t) => d.includes(t))) {
    return "Region 5";
  }
  return null;
}

// Forhandler → region/distrikt (Databank / kommersielle data)
export const DEALER_REGION_MAP: Record<string, number> = {
  "848": 1, "849": 1, "852": 1, "887": 1, "894": 1, "1165": 1,
  "839": 2, "857": 2, "858": 2, "863": 2, "892": 2,
  "808": 3, "826": 3, "851": 3, "870": 3, "898": 3,
  "802": 4, "871": 4, "897": 4, "1115": 4, "1116": 4, "1154": 4,
  "810": 5, "814": 5, "879": 5, "1104": 5, "1106": 5, "1122": 5, "1124": 5,
  "896": 9,
  "890": 10,
};

export const DEALER_DISTRICT_MAP: Record<string, string> = {
  "848": "Oslo", "849": "Drammen", "852": "Hønefoss", "887": "Jessheim", "894": "Gjøvik", "1165": "Lillehammer",
  "839": "Østfold", "857": "Hamar", "858": "Kongsvinger", "863": "Vestfold", "892": "Grenland",
  "808": "Kristiansand S", "826": "Haugesund", "851": "Bergen", "870": "Sandnes", "898": "Arendal",
  "802": "Ålesund", "871": "Molde", "897": "Trondheim", "1115": "Trondheim", "1116": "Trondheim", "1154": "Trondheim",
  "810": "Bodø", "814": "Tromsø", "879": "Harstad", "1104": "Alta", "1106": "Kirkenes", "1122": "Tromsø", "1124": "Harstad",
  "896": "Direct Sales", "890": "Volvo Norge",
};

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

export function isMappedNorwegianDealer(dealerValue: unknown): boolean {
  const code = normalizeDealerCode(dealerValue);
  return code !== "" && DEALER_REGION_MAP[code] != null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Kjøretøysegmentering (påbygg / O5C / ATOM / modell)
// ─────────────────────────────────────────────────────────────────────────────

export type PabyggSegment = "Construction" | "Distribution" | "Long Haul" | "Annet";

export const ALL_PABYGG_SEGMENTS: readonly PabyggSegment[] = [
  "Construction",
  "Distribution",
  "Long Haul",
  "Annet",
] as const;

export interface OFVPabyggEntry {
  code: number;
  segment: PabyggSegment;
  name: string;
}

export const OFV_PABYGG_MAP: Record<number, OFVPabyggEntry> = {
  [-1]: { code: -1, segment: "Long Haul", name: "Trekkvogn (uten påbygg)" },
  0: { code: 0, segment: "Annet", name: "Ikke oppgitt" },
  1: { code: 1, segment: "Distribution", name: "Plan" },
  2: { code: 2, segment: "Annet", name: "Plan med nedfellbare sidelemmer" },
  3: { code: 3, segment: "Distribution", name: "Skap" },
  4: { code: 4, segment: "Distribution", name: "Isolert skap med kjøleaggregat" },
  5: { code: 5, segment: "Distribution", name: "Isolert skap uten kjøleaggregat" },
  6: { code: 6, segment: "Distribution", name: "Gardin" },
  7: { code: 7, segment: "Annet", name: "Vekselflak" },
  8: { code: 8, segment: "Distribution", name: "Konteiner" },
  9: { code: 9, segment: "Construction", name: "Krokløft" },
  10: { code: 10, segment: "Construction", name: "Tipp" },
  11: { code: 11, segment: "Long Haul", name: "Tank" },
  12: { code: 12, segment: "Long Haul", name: "Tank for transport av farlig gods" },
  13: { code: 13, segment: "Annet", name: "Dyretransport" },
  14: { code: 14, segment: "Annet", name: "Biltransport" },
  15: { code: 15, segment: "Construction", name: "Betongblander" },
  16: { code: 16, segment: "Construction", name: "Pumpebil for betong" },
  17: { code: 17, segment: "Annet", name: "Tømmer" },
  18: { code: 18, segment: "Annet", name: "Renovasjon" },
  19: { code: 19, segment: "Annet", name: "Feiemaskin/Slamsuger" },
  20: { code: 20, segment: "Annet", name: "Kompressor" },
  21: { code: 21, segment: "Construction", name: "Båttransport" },
  22: { code: 22, segment: "Annet", name: "Glideflytransport" },
  23: { code: 23, segment: "Annet", name: "Salgsvogn" },
  24: { code: 24, segment: "Annet", name: "Bergingsbil" },
  25: { code: 25, segment: "Annet", name: "Stige" },
  26: { code: 26, segment: "Construction", name: "Kran" },
  27: { code: 27, segment: "Annet", name: "Liftbil" },
  28: { code: 28, segment: "Construction", name: "Bore" },
  29: { code: 29, segment: "Annet", name: "Svanehalshenger" },
  30: { code: 30, segment: "Distribution", name: "Transport av glass" },
  31: { code: 31, segment: "Annet", name: "Brannbil" },
  32: { code: 32, segment: "Distribution", name: "Kapell" },
  79: { code: 79, segment: "Long Haul", name: "Med svingskive (dolly)" },
  99: { code: 99, segment: "Annet", name: "Påbygg ikke dekket av andre koder" },
};

const _pabyggNameLookup: Record<string, PabyggSegment> = {};
for (const entry of Object.values(OFV_PABYGG_MAP)) {
  _pabyggNameLookup[entry.name.toLowerCase()] = entry.segment;
}

export function getOfvPabyggSegment(codeOrName: number | string): PabyggSegment {
  if (typeof codeOrName === "number") {
    return OFV_PABYGG_MAP[codeOrName]?.segment ?? "Annet";
  }
  const trimmed = codeOrName.trim();
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && OFV_PABYGG_MAP[num]) {
    return OFV_PABYGG_MAP[num].segment;
  }
  return _pabyggNameLookup[trimmed.toLowerCase()] ?? "Annet";
}

export function getOfvPabyggEntry(code: number): OFVPabyggEntry | undefined {
  return OFV_PABYGG_MAP[code];
}

export const ATOM_TRANSPORT_APP_SEGMENT: Record<string, PabyggSegment> = {
  Construction: "Construction",
  "Heavy construction": "Construction",
  "Heavy Transport": "Construction",
  "Interregional Haul": "Long Haul",
  "Demanding Long Haul": "Long Haul",
  "Tanker transports": "Long Haul",
  "Regional distribution": "Distribution",
  "City Distribution": "Distribution",
  "Waste & Recycling": "Annet",
  "Timber transports": "Annet",
};

export function getAtomPabyggSegment(transportApp: string | null | undefined): PabyggSegment {
  if (transportApp == null) return "Annet";
  const raw = String(transportApp).trim();
  if (!raw) return "Annet";
  const direct = ATOM_TRANSPORT_APP_SEGMENT[raw];
  if (direct) return direct;
  const norm = raw.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [k, seg] of Object.entries(ATOM_TRANSPORT_APP_SEGMENT)) {
    if (k.toLowerCase().replace(/\s+/g, " ").trim() === norm) return seg;
  }
  return "Annet";
}

export function looksLikeDaxValue(s: string): boolean {
  return /\b[468]x[2468]\b/i.test(s);
}

export function getDatabankBodySegment(
  bodyConnection: string | number | null | undefined,
  axleArrangement?: string | number | null | undefined,
): PabyggSegment {
  const val = String(bodyConnection ?? "").trim().toUpperCase();

  if (/^\d{1,3}$/.test(val)) {
    const seg = getOfvPabyggSegment(parseInt(val, 10));
    if (seg !== "Annet") return seg;
  }

  if (!val || val.length < 2) {
    const dax = String(axleArrangement ?? "").trim().toLowerCase();
    if (dax.includes("8x4") || dax.includes("8x6") || dax.includes("6x6")) return "Construction";
    if (dax.includes("4x2") || dax.includes("6x2") || dax.includes("6x4")) return "Long Haul";
    return "Annet";
  }

  if (
    val.startsWith("T-") ||
    val.includes("SVINGSKIVE") ||
    val.includes("DOLLY") ||
    val.includes("TREKK") ||
    val.includes("TANK") ||
    val.includes("BULK")
  ) {
    return "Long Haul";
  }

  if (
    val.includes("TIPP") || val.includes("KROK") || val.includes("BETONG") ||
    val.includes("KRAN") || val.includes("BORE") || val.includes("PUMP") ||
    val.includes("ANLEGG") || val.includes("HOOK") || val.includes("DUMPER") ||
    val.includes("SKIPL") || val.includes("CONM") || val.includes("CONP") ||
    val === "B-HH"
  ) {
    return "Construction";
  }

  if (
    val.includes("SKAP") || val.includes("GARDIN") || val.includes("KAPELL") ||
    val.includes("KJØL") || val.includes("THERMO") ||
    val.includes("KONTEINER") || val.includes("CONTAINER") || val.includes("PLAN") ||
    val.includes("FLAT") || val.includes("PLATFORM") || val.includes("FIXED_PLATFORM") ||
    val.includes("GLASS") || val.includes("DISTRIBU") || val.includes("ISOLERT") ||
    val.includes("VANB") || val.includes("CONT") || val.includes("SWAP")
  ) {
    return "Distribution";
  }

  if (
    val.includes("REFUS") || val.includes("RENOVAS") || val.includes("TØMMER") ||
    val.includes("TIMBER") || val.includes("TIMBR") || val.includes("BRANN") || val.includes("BERGING") ||
    val.includes("DYR") || val.includes("BIL") || val.includes("SPECB") ||
    val.includes("WOODC") || val.includes("VEHITR")
  ) {
    return "Annet";
  }

  return "Annet";
}

export function inferSegmentFromVolvoModelHints(combinedLower: string): PabyggSegment | null {
  const s = combinedLower;
  if (/\bfmx\b|fmx[-\s]|volvo fmx/i.test(s)) return "Construction";
  if (/\bfh[-\s]*[0-9]{2,}|\bfh4\b|\bfh5\b|\bfh6\b|volvo fh\b|fh[0-9]{3}\b/i.test(s)) return "Long Haul";
  if (/\bfe[-\s]?[0-9]|\bfl[-\s]?[0-9]|volvo fe\b|volvo fl\b/i.test(s)) return "Distribution";
  if (/\bfm[-\s]?[0-9]|volvo fm\b/i.test(s) && !s.includes("fmx")) return "Distribution";
  if (/\btrekkvogn\b|\blong haul\b|\binterregional\b|\bsvingskive\b|\bdolly\b/i.test(s)) return "Long Haul";
  if (/\btipp\b|\btippe\b|\bdumper\b|\bkran\b|\bbetong\b|\banlegg\b|\bkrokløft\b/i.test(s)) return "Construction";
  if (/\bdistribu\b|\bskap\b|\bgardin\b|\bkapell\b|\bkjøl\b|\bthermo\b|\bcity\b|\bregional\b/i.test(s)) {
    return "Distribution";
  }
  return null;
}

export function classifyTilbudModelToSegment(
  modelVersion: string,
  modelDescription: string,
  bodyConnection?: string | number | null,
): PabyggSegment {
  const combined = `${modelVersion || ""} ${modelDescription || ""}`.toLowerCase();
  const bcStr = String(bodyConnection ?? "").trim();
  if (bcStr.length >= 2) {
    const o5cResult = getDatabankBodySegment(bcStr);
    if (o5cResult !== "Annet") return o5cResult;
    if (
      combined.includes("trekk") || combined.includes("long haul") ||
      combined.includes("interregional") || combined.includes("svingskive") || combined.includes("dolly")
    ) return "Long Haul";
    if (
      combined.includes("fmx") || combined.includes("anlegg") || combined.includes("tipp") ||
      combined.includes("kran") || combined.includes("betong") || combined.includes("construction") ||
      combined.includes("heavy transport")
    ) return "Construction";
    if (
      combined.includes("distribu") || combined.includes("skap") ||
      combined.includes("city") || combined.includes("regional")
    ) return "Distribution";
    return inferSegmentFromVolvoModelHints(combined) ?? "Annet";
  }
  if (
    combined.includes("fmx") || combined.includes("anlegg") || combined.includes("tipp") ||
    combined.includes("kran") || combined.includes("betong") || combined.includes("bore") ||
    combined.includes("construction") || combined.includes("heavy transport") ||
    combined.includes("krokløft") || combined.includes("hook")
  ) return "Construction";
  if (
    combined.includes("distribu") || combined.includes("skap") || combined.includes("fe ") ||
    combined.includes("fl ") || combined.includes("fme") || combined.includes("city") ||
    combined.includes("regional") || combined.includes("gardin") || combined.includes("kapell") ||
    combined.includes("kjøl") || combined.includes("thermo") || combined.includes("tank")
  ) return "Distribution";
  if (
    combined.includes("trekk") || combined.includes("long haul") ||
    combined.includes("interregional") || combined.includes("svingskive") || combined.includes("dolly")
  ) return "Long Haul";
  return inferSegmentFromVolvoModelHints(combined) ?? "Annet";
}

export function classifyDatabankOrderToSegment(order: {
  transportApp?: string | number | null;
  bodyConnection?: string | number | null;
  axleArrangement?: string | number | null;
  model?: string | number | null;
  engineVersion?: string | number | null;
}): PabyggSegment {
  const transportApp = order.transportApp != null ? String(order.transportApp).trim() : "";
  const bodyConnection =
    order.bodyConnection != null && String(order.bodyConnection).trim() !== ""
      ? String(order.bodyConnection).trim()
      : undefined;
  const axleArrangement =
    order.axleArrangement != null && String(order.axleArrangement).trim() !== ""
      ? String(order.axleArrangement).trim()
      : undefined;
  const modelVersion = order.model != null ? String(order.model).trim() : "";
  const engineVersion = order.engineVersion != null ? String(order.engineVersion).trim() : "";

  if (transportApp) {
    const atomSeg = getAtomPabyggSegment(transportApp);
    if (atomSeg !== "Annet") return atomSeg;
  }
  const fromChassis = getDatabankBodySegment(bodyConnection, axleArrangement);
  if (fromChassis !== "Annet") return fromChassis;
  const modelDescription = [engineVersion, axleArrangement].filter(Boolean).join(" ").trim();
  return classifyTilbudModelToSegment(modelVersion, modelDescription, bodyConnection);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Tractor vs Rigid
// ─────────────────────────────────────────────────────────────────────────────

export type TrekkerJevnlastSegment = "trekker" | "jevnlast";
export type ParticipationSegment = "trekkvogn" | "standard" | "spesial";

export const TREKKER_JEVNLAST_CONFIG = {
  trekker: { leadDays: 150, windowDays: 30, label: "Trekker" },
  jevnlast: { leadDays: 141, windowDays: 30, label: "Jevnlast" },
} as const;

export const PARTICIPATION_CONFIG = {
  make: "Volvo",
  minWeightKg: DEFAULT_MIN_WEIGHT_KG,
  monthsBack: 12,
  tractorMonthsBack: 6,
  standardMonthsBack: 12,
  specialMonthsBack: 15,
} as const;

export function classifyTrekkerJevnlast(modelVersion: string, modelDescription = ""): TrekkerJevnlastSegment {
  const combined = `${modelVersion || ""} ${modelDescription || ""}`.toLowerCase();
  if (
    combined.includes("4x2") || combined.includes("6x2") || combined.includes("trekk") ||
    combined.includes("tractor") || combined.includes("t 4x2") || combined.includes("t 6x2")
  ) return "trekker";
  if (
    combined.includes("6x4") || combined.includes("8x4") || combined.includes("8x2") ||
    combined.includes("rigid") || combined.includes("distribu") || combined.includes("anlegg") ||
    combined.includes("kran") || combined.includes("tipp")
  ) return "jevnlast";
  if (combined.includes("fmx")) return "jevnlast";
  return "trekker";
}

export function classifyParticipationSegment(input: {
  model?: string;
  bodywork?: string;
}): ParticipationSegment {
  const model = String(input.model ?? "").toLowerCase();
  const bodywork = String(input.bodywork ?? "").toLowerCase();
  const combined = `${bodywork} ${model}`;
  const bodyworkCodeMatch = bodywork.match(/^-?\d{1,3}\b/);
  const bodyworkCode = bodyworkCodeMatch ? Number(bodyworkCodeMatch[0]) : null;

  if (bodyworkCode !== null) {
    if ([-1, 11, 12, 79].includes(bodyworkCode)) return "trekkvogn";
    if ([4, 13, 14, 15, 16, 17, 18, 19].includes(bodyworkCode)) return "spesial";
    if (![0, 99].includes(bodyworkCode)) return "standard";
  }
  if (
    combined.includes("trekkvogn") || combined.includes("tractor") || combined.includes("long haul") ||
    combined.includes("interregional") || combined.includes("svingskive") || combined.includes("dolly") ||
    combined.includes("tank") || combined.includes("bulk")
  ) return "trekkvogn";
  if (/\bfh[-\s]*[0-9]{2,}|\bfh4\b|\bfh5\b|\bfh6\b|volvo fh\b|fh[0-9]{3}\b/i.test(combined)) return "trekkvogn";
  if (
    /feie|slamsuger|renovasjon|dyretransport|betong|isolert|kjøl|kjole|biltransport|tank|tømmer|tommer/.test(combined)
  ) return "spesial";
  return "standard";
}

export function isLikelyTruckRegistration(input: {
  vin?: string;
  model?: string;
  bodywork?: string;
}): boolean {
  const vin = String(input.vin ?? "").toUpperCase();
  const model = String(input.model ?? "").toLowerCase();
  const bodywork = String(input.bodywork ?? "").toLowerCase();
  if (vin.startsWith("YV3")) return false;
  if (/\b9700\b/.test(model) || model.includes("volvo 9700")) return false;
  if (/\b(ebu|tbu)\b/i.test(bodywork)) return false;
  if (bodywork.includes("buss") || bodywork.includes("bus")) return false;
  if (model.includes("buss") || model.includes("bus")) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. HK (hestekrefter)
// ─────────────────────────────────────────────────────────────────────────────

export interface HpBucket {
  label: string;
  min: number;
  max: number;
}

export const HP_BUCKETS: readonly HpBucket[] = [
  { label: "<500 HK", min: 0, max: 499 },
  { label: "≥500<540 HK", min: 500, max: 539 },
  { label: "≥540<600 HK", min: 540, max: 599 },
  { label: "≥600<700 HK", min: 600, max: 699 },
  { label: "≥700 HK", min: 700, max: Infinity },
] as const;

export const HP_BUCKET_THRESHOLDS = [500, 540, 600, 700] as const;

export const HP_BUCKET_ORDER = ["<500", ">=500<540", ">=540<600", ">=600<700", ">=700"] as const;
export type HpBucketKey = (typeof HP_BUCKET_ORDER)[number];

export const HP_BUCKET_LABELS: Record<HpBucketKey, string> = {
  "<500": "<500 HK",
  ">=500<540": "≥500<540 HK",
  ">=540<600": "≥540<600 HK",
  ">=600<700": "≥600<700 HK",
  ">=700": "≥700 HK",
};

/** Beregn effektiv HK fra HP og/eller kW */
export function effectiveHorsepower(hp: number, kw = 0): number {
  if (hp > 0) return hp;
  if (kw > 0) return Math.round(kw * KW_TO_HP_FACTOR);
  return 0;
}

/** Klassifiser HK til display-bøtte (f.eks. "≥540<600 HK") */
export function classifyHpBucketLabel(hp: number): string | null {
  if (hp <= 0) return null;
  for (const b of HP_BUCKETS) {
    if (hp >= b.min && hp <= b.max) return b.label;
  }
  return null;
}

/** Klassifiser HK til edge-function-nøkkel (f.eks. ">=540<600") */
export function classifyHpBucketKey(hp: number): HpBucketKey | null {
  if (hp <= 0) return null;
  if (hp >= 700) return ">=700";
  if (hp >= 600) return ">=600<700";
  if (hp >= 540) return ">=540<600";
  if (hp >= 500) return ">=500<540";
  return "<500";
}

export function hpBucketKeyToLabel(key: HpBucketKey | string | null): string | null {
  if (!key) return null;
  return HP_BUCKET_LABELS[key as HpBucketKey] ?? null;
}

/**
 * Ordinal 1-5 brukt av den genererte hp_bucket-kolonnen i databasen,
 * i samme rekkefølge som HP_BUCKET_ORDER.
 */
export function getHpBucketLabel(ordinal: number): string {
  const key = HP_BUCKET_ORDER[ordinal - 1];
  return (key && HP_BUCKET_LABELS[key]) || `Bøtte ${ordinal}`;
}

/** Nedtrekksvalg for HK-filteret (ordinal 1-5 + lesbar etikett). */
export const HP_BUCKET_FILTER_OPTIONS: { value: number; label: string }[] =
  HP_BUCKET_ORDER.map((key, index) => ({
    value: index + 1,
    label: HP_BUCKET_LABELS[key],
  }));

/** Parse HK fra HAX/motorstreng (f.eks. "D13TC540" → 540) */
export function parseHpFromEngineVersion(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const s = val.trim().toUpperCase();
  const match = s.match(/(\d{3,4})\s*(?:HP)?$/);
  if (match?.[1]) {
    const hp = parseInt(match[1], 10);
    if (hp >= 100 && hp <= 1000) return hp;
  }
  const anyMatch = s.match(/(\d{3})/);
  if (anyMatch?.[1]) {
    const hp = parseInt(anyMatch[1], 10);
    if (hp >= 200 && hp <= 800) return hp;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Slagvolum (displacement)
// ─────────────────────────────────────────────────────────────────────────────

export const DISPLACEMENT_BUCKET_THRESHOLDS = [8500, 10000, 12000, 15000] as const;

export const DISP_BUCKET_ORDER = ["electric", "<8500", "8500", "10000", "12000", ">=15000"] as const;
export type DispBucketKey = (typeof DISP_BUCKET_ORDER)[number];

export const DISP_BUCKET_LABELS: Record<DispBucketKey, string> = {
  electric: "Elektrisk",
  "<8500": "<9L",
  "8500": "9L",
  "10000": "11L",
  "12000": "13L",
  ">=15000": "≥16L",
};

export function classifyDisplacementBucket(cc: number): DispBucketKey {
  if (cc <= 0) return "electric";
  const thresholds = DISPLACEMENT_BUCKET_THRESHOLDS;
  if (cc < thresholds[0]) return "<8500";
  if (cc < thresholds[1]) return "8500";
  if (cc < thresholds[2]) return "10000";
  if (cc < thresholds[3]) return "12000";
  return ">=15000";
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Flåtesegmentering
// ─────────────────────────────────────────────────────────────────────────────

export const FLEET_INTERVALS = [
  { label: "1–10", min: 1, max: 10 },
  { label: "11–30", min: 11, max: 30 },
  { label: "31–50", min: 31, max: 50 },
  { label: ">50", min: 51, max: Infinity },
] as const;

export const FLEET_EXCLUDED_PATTERNS: readonly RegExp[] = [
  /finans/i, /leasing/i, /finance/i, /kapital/i, /kredit/i,
  /dnb\b/i, /nordea/i, /handelsbank/i, /santander/i,
  /sg finans/i, /de lage landen/i, /caterpillar financial/i,
  /bnp paribas/i, /resurs/i, /fleet management/i,
  /ayvens/i, /danske bank/i, /sparebank/i,
  /\bvolvo\b/i, /\bscania\b/i, /\bman\b/i, /\bdaf\b/i,
  /mercedes[\s-]?benz/i, /\biveco\b/i, /renault\s*trucks/i,
  /\bsany\b/i, /\bisuzu\b/i, /\bmitsubishi\b/i,
  /volvo truck/i, /volvo group/i, /traton/i,
];

export const DIRECT_SALES_DEALER_CODE = "896";

export function isExcludedFleetOwner(name: string): boolean {
  return FLEET_EXCLUDED_PATTERNS.some((re) => re.test(name));
}

export function classifyFleetSize(count: number): string | null {
  for (const interval of FLEET_INTERVALS) {
    if (count >= interval.min && count <= interval.max) return interval.label;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Hjelpere for volvo-ofv UI (region-nedslag fra sales_region-kolonnen)
// ─────────────────────────────────────────────────────────────────────────────

/** Regionnumre som utledes fra postnummer (Volvo-forhandlernett). */
export const POSTAL_SALES_REGIONS = [1, 2, 3, 4, 5] as const;
export type PostalSalesRegion = (typeof POSTAL_SALES_REGIONS)[number];

/** Kort, UI-vennlig navn per regionnummer ("Region 1 – Volvo Truck Center"). */
export function getRegionLabel(region: number): string {
  const name = REGION_NAMES[region];
  return name ? `Region ${region} – ${name}` : `Region ${region}`;
}

/** Nedtrekksvalg for region-filteret (kun postnummer-baserte regioner 1–5). */
export const REGION_FILTER_OPTIONS: { value: number; label: string }[] =
  POSTAL_SALES_REGIONS.map((region) => ({
    value: region,
    label: getRegionLabel(region),
  }));
