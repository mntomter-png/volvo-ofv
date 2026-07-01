import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { MakeShare, MonthlyRegistration } from "@/lib/dashboard/queries";
import {
  CHASSIS_FILTER_OPTIONS,
  classifyFleetSize,
  DISP_BUCKET_FILTER_OPTIONS,
  FLEET_INTERVALS,
  getDispBucketLabel,
  getHpBucketLabel,
  getPabyggSegmentLabel,
  getRegionLabel,
  HP_BUCKET_FILTER_OPTIONS,
  isExcludedFleetOwner,
  PABYGG_FILTER_OPTIONS,
  REGION_FILTER_OPTIONS,
} from "@/lib/ofv/segmentation";
import { REGISTRATIONS_PAGE_SIZE } from "@/lib/registrations/constants";
import {
  HEAVY_TRUCK_MIN_KG,
  OFV_TRANSACTION_NEW_REGISTRATION,
  type RegistrationsFilters,
} from "@/lib/registrations/filters";
import {
  comparisonPeriodLabel,
  previousPeriodFilters,
  resolveRegistrationPeriod,
  type KpiYoYComparison,
} from "@/lib/kpi/yoy";

const MONTH_LABELS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "mai",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "des",
] as const;

function formatMonthLabel(isoDate: string): string {
  const month = Number.parseInt(isoDate.slice(5, 7), 10) - 1;
  const year = isoDate.slice(0, 4);
  return `${MONTH_LABELS[month] ?? isoDate} ${year}`;
}

export interface RegistrationRow {
  registration_number: string;
  transaction_time: string;
  make_name: string | null;
  model_name: string | null;
  variant_name: string | null;
  usage_name: string | null;
  maximum_laden_mass_kg: number | null;
  sales_region: number | null;
  hp_bucket: number | null;
  fuel_name: string | null;
  pabygg_segment: string | null;
  primary_owner_name: string | null;
  primary_owner_postal_code: string | null;
  primary_owner_postal_district: string | null;
  primary_user_name: string | null;
  primary_user_postal_code: string | null;
  primary_user_postal_district: string | null;
}

export interface RegistrationsSummary {
  total: number;
  volvoCount: number;
  volvoShare: number;
  /** Sammenligning med tilsvarende periode året før (null hvis ikke tilgjengelig). */
  yoy: KpiYoYComparison | null;
}

export interface RegionShare {
  region: number;
  label: string;
  count: number;
  volvo_count: number;
}

export interface RegionOption {
  value: number;
  label: string;
}

export interface HpShare {
  bucket: number;
  label: string;
  count: number;
  volvo_count: number;
}

export interface HpOption {
  value: number;
  label: string;
}

export interface FuelShare {
  fuel: string;
  count: number;
  volvo_count: number;
}

export interface PabyggShare {
  pabygg: string;
  label: string;
  count: number;
  volvo_count: number;
}

export interface DispShare {
  bucket: number;
  label: string;
  count: number;
  volvo_count: number;
}

export interface FleetSizeBand {
  label: string;
  owners: number;
  count: number;
  volvo_count: number;
}

export interface FleetOwner {
  name: string;
  count: number;
  volvo_count: number;
}

export interface FleetAnalysis {
  /** Antall reelle flåte-eiere (ekskl. finans/leasing/importør). */
  ownerCount: number;
  bands: FleetSizeBand[];
  topOwners: FleetOwner[];
}

export interface RegistrationsPageData {
  filters: RegistrationsFilters;
  summary: RegistrationsSummary;
  segments: string[];
  makes: string[];
  regions: RegionOption[];
  hpBuckets: HpOption[];
  fuels: string[];
  pabyggOptions: typeof PABYGG_FILTER_OPTIONS;
  dispOptions: typeof DISP_BUCKET_FILTER_OPTIONS;
  chassisOptions: typeof CHASSIS_FILTER_OPTIONS;
  byMonth: MonthlyRegistration[];
  byMake: MakeShare[];
  byRegion: RegionShare[];
  byHp: HpShare[];
  byFuel: FuelShare[];
  byPabygg: PabyggShare[];
  byDisp: DispShare[];
  fleet: FleetAnalysis;
  rows: RegistrationRow[];
  totalRows: number;
  totalPages: number;
}

const FLEET_TOP_OWNERS = 10;

function buildFleetAnalysis(
  rows: { owner_name: string; count: number; volvo_count: number }[],
): FleetAnalysis {
  const owners = rows.filter(
    (row) => row.owner_name && !isExcludedFleetOwner(row.owner_name),
  );

  const bands: FleetSizeBand[] = FLEET_INTERVALS.map((interval) => ({
    label: interval.label,
    owners: 0,
    count: 0,
    volvo_count: 0,
  }));

  for (const owner of owners) {
    const label = classifyFleetSize(owner.count);
    if (!label) continue;
    const band = bands.find((b) => b.label === label);
    if (!band) continue;
    band.owners += 1;
    band.count += owner.count;
    band.volvo_count += owner.volvo_count;
  }

  const topOwners: FleetOwner[] = owners
    .slice(0, FLEET_TOP_OWNERS)
    .map((owner) => ({
      name: owner.owner_name,
      count: owner.count,
      volvo_count: owner.volvo_count,
    }));

  return { ownerCount: owners.length, bands, topOwners };
}

/** Fra/til-datoer som brukes når år er valgt uten eksplisitt datointervall. */
function effectiveRegistrationDates(filters: RegistrationsFilters) {
  if (filters.from || filters.to) {
    return { from: filters.from, to: filters.to };
  }
  const period = resolveRegistrationPeriod(filters);
  return { from: period.from, to: period.to };
}

interface FilterableQuery<Q> {
  eq: (column: string, value: string | number) => Q;
  gt: (column: string, value: string | number) => Q;
  gte: (column: string, value: string | number) => Q;
  lt: (column: string, value: string | number) => Q;
}

/** Eksklusiv øvre grense (slutten av to-datoen) som ISO-tidsstempel. */
function endOfDayExclusive(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.toISOString().slice(0, 10)}T00:00:00`;
}

function applyRegistrationFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: RegistrationsFilters,
) {
  let q = query
    .eq("transaction_type_id", OFV_TRANSACTION_NEW_REGISTRATION)
    .gte("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG);

  if (filters.from || filters.to) {
    if (filters.from) {
      q = q.gte("transaction_time", `${filters.from}T00:00:00`);
    }
    if (filters.to) {
      q = q.lt("transaction_time", endOfDayExclusive(filters.to));
    }
  } else {
    const { from, to } = resolveRegistrationPeriod(filters);
    q = q
      .gte("transaction_time", `${from}T00:00:00`)
      .lt("transaction_time", endOfDayExclusive(to));
  }

  if (filters.segment) {
    q = q.eq("usage_name", filters.segment);
  }
  if (filters.make) {
    q = q.eq("make_name", filters.make);
  }
  if (filters.region) {
    q = q.eq("sales_region", filters.region);
  }
  if (filters.hp) {
    q = q.eq("hp_bucket", filters.hp);
  }
  if (filters.fuel) {
    q = q.eq("fuel_name", filters.fuel);
  }
  if (filters.pabygg) {
    q = q.eq("pabygg_segment", filters.pabygg);
  }
  if (filters.disp) {
    q = q.eq("disp_bucket", filters.disp);
  }
  if (filters.chassis) {
    q = q.eq("trekker_jevnlast", filters.chassis);
  }
  return q;
}

async function fetchRegistrationsSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: RegistrationsFilters,
): Promise<Pick<RegistrationsSummary, "total" | "volvoCount" | "volvoShare">> {
  const [countRes, volvoCountRes] = await Promise.all([
    applyRegistrationFilters(
      supabase.from("registrations").select("*", { count: "exact", head: true }),
      filters,
    ),
    applyRegistrationFilters(
      supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("make_name", "Volvo"),
      filters,
    ),
  ]);

  const total = countRes.count ?? 0;
  const volvoCount = volvoCountRes.count ?? 0;

  return {
    total,
    volvoCount,
    volvoShare: total > 0 ? (volvoCount / total) * 100 : 0,
  };
}

export async function getRegistrationsPageData(
  filters: RegistrationsFilters,
): Promise<RegistrationsPageData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;

  const prevFilters = previousPeriodFilters(filters);
  const { from: rpcFrom, to: rpcTo } = effectiveRegistrationDates(filters);

  const countQuery = applyRegistrationFilters(
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    filters,
  );
  const volvoCountQuery = applyRegistrationFilters(
    supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("make_name", "Volvo"),
    filters,
  );

  const offset = (filters.page - 1) * REGISTRATIONS_PAGE_SIZE;
  const rowsQuery = applyRegistrationFilters(
    supabase
      .from("registrations")
      .select(
        "registration_number, transaction_time, make_name, model_name, variant_name, usage_name, maximum_laden_mass_kg, primary_owner_name, primary_owner_postal_code, primary_owner_postal_district, primary_user_name, primary_user_postal_code, primary_user_postal_district",
      )
      .order("transaction_time", { ascending: false })
      .range(offset, offset + REGISTRATIONS_PAGE_SIZE - 1),
    filters,
  );

  const [
    countRes,
    volvoCountRes,
    prevSummaryRes,
    rowsRes,
    monthlyRes,
    byMakeRes,
    byRegionRes,
    byHpRes,
    byFuelRes,
    byPabyggRes,
    byDispRes,
    fleetRes,
    segmentsRes,
  ] = await Promise.all([
    countQuery,
    volvoCountQuery,
    prevFilters
      ? fetchRegistrationsSummary(supabase, prevFilters)
      : Promise.resolve(null),
    rowsQuery,
    rpcClient.rpc("reg_summary_by_month", {
      p_year: filters.year,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_segment: filters.segment,
      p_make: filters.make,
      p_region: filters.region,
      p_hp: filters.hp,
      p_fuel: filters.fuel,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
    }),
    rpcClient.rpc("reg_summary_by_make", {
      p_year: filters.year,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_segment: filters.segment,
      p_make: filters.make,
      p_month: filters.month,
      p_region: filters.region,
      p_hp: filters.hp,
      p_fuel: filters.fuel,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
    }),
    rpcClient.rpc("reg_summary_by_region", {
      p_year: filters.year,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_segment: filters.segment,
      p_make: filters.make,
      p_month: filters.month,
      p_hp: filters.hp,
      p_fuel: filters.fuel,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
    }),
    rpcClient.rpc("reg_summary_by_hp", {
      p_year: filters.year,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_segment: filters.segment,
      p_make: filters.make,
      p_month: filters.month,
      p_region: filters.region,
      p_fuel: filters.fuel,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
    }),
    rpcClient.rpc("reg_summary_by_fuel", {
      p_year: filters.year,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_segment: filters.segment,
      p_make: filters.make,
      p_month: filters.month,
      p_region: filters.region,
      p_hp: filters.hp,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
    }),
    rpcClient.rpc("reg_summary_by_pabygg", {
      p_year: filters.year,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_segment: filters.segment,
      p_make: filters.make,
      p_month: filters.month,
      p_region: filters.region,
      p_hp: filters.hp,
      p_fuel: filters.fuel,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
    }),
    rpcClient.rpc("reg_summary_by_disp", {
      p_year: filters.year,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_segment: filters.segment,
      p_make: filters.make,
      p_month: filters.month,
      p_region: filters.region,
      p_hp: filters.hp,
      p_fuel: filters.fuel,
      p_pabygg: filters.pabygg,
      p_chassis: filters.chassis,
    }),
    rpcClient.rpc("reg_fleet_owners", {
      p_year: filters.year,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_segment: filters.segment,
      p_region: filters.region,
      p_hp: filters.hp,
      p_fuel: filters.fuel,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
    }),
    supabase
      .from("dashboard_registrations_by_segment")
      .select("segment")
      .returns<{ segment: string }[]>(),
  ]);

  const makesRes = await rpcClient.rpc("reg_summary_by_make", {
    p_year: filters.year,
    p_segment: filters.segment,
    p_make: null,
    p_from: rpcFrom,
    p_to: rpcTo,
  });

  const totalRows = countRes.count ?? 0;
  const volvoCount = volvoCountRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / REGISTRATIONS_PAGE_SIZE));

  const yoy =
    prevFilters && prevSummaryRes
      ? {
          periodLabel: comparisonPeriodLabel(filters),
          total: prevSummaryRes.total,
          volvoCount: prevSummaryRes.volvoCount,
          volvoShare: prevSummaryRes.volvoShare,
        }
      : null;

  return {
    filters,
    summary: {
      total: totalRows,
      volvoCount,
      volvoShare: totalRows > 0 ? (volvoCount / totalRows) * 100 : 0,
      yoy,
    },
    segments: (segmentsRes.data ?? []).map((row) => row.segment),
    makes: (makesRes.data ?? []).map((row) => row.make_name),
    regions: REGION_FILTER_OPTIONS,
    hpBuckets: HP_BUCKET_FILTER_OPTIONS,
    fuels: (byFuelRes.data ?? []).map((row) => row.fuel),
    pabyggOptions: PABYGG_FILTER_OPTIONS,
    dispOptions: DISP_BUCKET_FILTER_OPTIONS,
    chassisOptions: CHASSIS_FILTER_OPTIONS,
    byMonth: (monthlyRes.data ?? []).map((row) => ({
      month: row.month,
      count: row.count,
      label: formatMonthLabel(row.month),
    })),
    byMake: (byMakeRes.data ?? []).slice(0, 10),
    byRegion: (byRegionRes.data ?? []).map((row) => ({
      region: row.region,
      label: getRegionLabel(row.region),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byHp: (byHpRes.data ?? []).map((row) => ({
      bucket: row.bucket,
      label: getHpBucketLabel(row.bucket),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byFuel: (byFuelRes.data ?? []).map((row) => ({
      fuel: row.fuel,
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byPabygg: (byPabyggRes.data ?? []).map((row) => ({
      pabygg: row.pabygg,
      label: getPabyggSegmentLabel(row.pabygg),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byDisp: (byDispRes.data ?? []).map((row) => ({
      bucket: row.bucket,
      label: getDispBucketLabel(row.bucket),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    fleet: buildFleetAnalysis(fleetRes.data ?? []),
    rows: rowsRes.data ?? [],
    totalRows,
    totalPages,
  };
}

const EXPORT_BATCH_SIZE = 1000;
const EXPORT_MAX_ROWS = 50000;

const REGISTRATION_EXPORT_COLUMNS =
  "registration_number, transaction_time, make_name, model_name, variant_name, usage_name, maximum_laden_mass_kg, sales_region, hp_bucket, fuel_name, pabygg_segment, primary_owner_name, primary_owner_postal_code, primary_owner_postal_district, primary_user_name, primary_user_postal_code, primary_user_postal_district";

export async function getAllRegistrationsForExport(
  filters: RegistrationsFilters,
): Promise<RegistrationRow[]> {
  const supabase = await createClient();
  const all: RegistrationRow[] = [];

  for (let offset = 0; offset < EXPORT_MAX_ROWS; offset += EXPORT_BATCH_SIZE) {
    const batchQuery = applyRegistrationFilters(
      supabase
        .from("registrations")
        .select(REGISTRATION_EXPORT_COLUMNS)
        .order("transaction_time", { ascending: false })
        .range(offset, offset + EXPORT_BATCH_SIZE - 1),
      filters,
    );

    const { data } = await batchQuery;
    const batch = (data ?? []) as unknown as RegistrationRow[];
    all.push(...batch);

    if (batch.length < EXPORT_BATCH_SIZE) break;
  }

  return all;
}
