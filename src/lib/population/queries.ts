import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { MakeShare, SegmentShare } from "@/lib/dashboard/queries";
import {
  CHASSIS_FILTER_OPTIONS,
  DISP_BUCKET_FILTER_OPTIONS,
  getRegionLabel,
  HP_BUCKET_FILTER_OPTIONS,
  PABYGG_FILTER_OPTIONS,
  REGION_FILTER_OPTIONS,
} from "@/lib/ofv/segmentation";
import { POPULATION_PAGE_SIZE } from "@/lib/population/constants";
import {
  AGE_FILTER_OPTIONS,
  HEAVY_TRUCK_MIN_KG,
  type PopulationFilters,
} from "@/lib/population/filters";

export interface PopulationRow {
  registration_number: string;
  make_name: string | null;
  model_name: string | null;
  usage_name: string | null;
  maximum_laden_mass_kg: number | null;
  first_registration_date: string | null;
  vehicle_status: string | null;
  primary_owner_name: string | null;
  primary_owner_postal_code: string | null;
  primary_owner_postal_district: string | null;
  primary_user_name: string | null;
  primary_user_postal_code: string | null;
  primary_user_postal_district: string | null;
}

export interface PopulationSummary {
  total: number;
  volvoCount: number;
  volvoShare: number;
}

export interface RegionShare {
  region: number;
  label: string;
  count: number;
  volvo_count: number;
}

export interface FuelShare {
  fuel: string;
  count: number;
  volvo_count: number;
}

export interface PopulationPageData {
  filters: PopulationFilters;
  summary: PopulationSummary;
  snapshotDate: string | null;
  segments: string[];
  makes: string[];
  regions: typeof REGION_FILTER_OPTIONS;
  hpBuckets: typeof HP_BUCKET_FILTER_OPTIONS;
  fuels: string[];
  pabyggOptions: typeof PABYGG_FILTER_OPTIONS;
  dispOptions: typeof DISP_BUCKET_FILTER_OPTIONS;
  chassisOptions: typeof CHASSIS_FILTER_OPTIONS;
  ageOptions: typeof AGE_FILTER_OPTIONS;
  byMake: MakeShare[];
  bySegment: SegmentShare[];
  byRegion: RegionShare[];
  byFuel: FuelShare[];
  rows: PopulationRow[];
  totalRows: number;
  totalPages: number;
}

interface FilterableQuery<Q> {
  eq: (column: string, value: string | number) => Q;
  gt: (column: string, value: string | number) => Q;
}

function popRpcArgs(filters: PopulationFilters) {
  return {
    p_segment: filters.segment,
    p_make: filters.make,
    p_region: filters.region,
    p_hp: filters.hp,
    p_fuel: filters.fuel,
    p_pabygg: filters.pabygg,
    p_disp: filters.disp,
    p_chassis: filters.chassis,
    p_age: filters.age,
  };
}

/** Skjæringsdato (10 år tilbake) på formatet YYYY-MM-DD. */
function tenYearCutoff(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 10);
  return date.toISOString().slice(0, 10);
}

interface AgeFilterableQuery<Q> extends FilterableQuery<Q> {
  gte: (column: string, value: string | number) => Q;
  lt: (column: string, value: string | number) => Q;
}

function applyPopulationFilters<T extends AgeFilterableQuery<T>>(
  query: T,
  filters: PopulationFilters,
  snapshotDate: string,
) {
  let q = query
    .eq("snapshot_date", snapshotDate)
    .gt("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG);

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
  if (filters.age === "under10") {
    q = q.gte("first_registration_date", tenYearCutoff());
  } else if (filters.age === "over10") {
    q = q.lt("first_registration_date", tenYearCutoff());
  }
  return q;
}

export async function getPopulationPageData(
  filters: PopulationFilters,
): Promise<PopulationPageData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;

  const latestSnapshotRes = await supabase
    .from("population")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ snapshot_date: string }>();

  const snapshotDate = latestSnapshotRes.data?.snapshot_date ?? null;

  if (!snapshotDate) {
    return {
      filters,
      summary: { total: 0, volvoCount: 0, volvoShare: 0 },
      snapshotDate: null,
      segments: [],
      makes: [],
      regions: REGION_FILTER_OPTIONS,
      hpBuckets: HP_BUCKET_FILTER_OPTIONS,
      fuels: [],
      pabyggOptions: PABYGG_FILTER_OPTIONS,
      dispOptions: DISP_BUCKET_FILTER_OPTIONS,
      chassisOptions: CHASSIS_FILTER_OPTIONS,
      ageOptions: AGE_FILTER_OPTIONS,
      byMake: [],
      bySegment: [],
      byRegion: [],
      byFuel: [],
      rows: [],
      totalRows: 0,
      totalPages: 1,
    };
  }

  const countQuery = applyPopulationFilters(
    supabase.from("population").select("*", { count: "exact", head: true }),
    filters,
    snapshotDate,
  );
  const volvoCountQuery = applyPopulationFilters(
    supabase
      .from("population")
      .select("*", { count: "exact", head: true })
      .eq("make_name", "Volvo"),
    filters,
    snapshotDate,
  );

  const offset = (filters.page - 1) * POPULATION_PAGE_SIZE;
  const rowsQuery = applyPopulationFilters(
    supabase
      .from("population")
      .select(
        "registration_number, make_name, model_name, usage_name, maximum_laden_mass_kg, first_registration_date, vehicle_status, primary_owner_name, primary_owner_postal_code, primary_owner_postal_district, primary_user_name, primary_user_postal_code, primary_user_postal_district",
      )
      .order("registration_number", { ascending: true })
      .range(offset, offset + POPULATION_PAGE_SIZE - 1),
    filters,
    snapshotDate,
  );

  const rpcArgs = popRpcArgs(filters);

  const [
    countRes,
    volvoCountRes,
    rowsRes,
    byMakeRes,
    bySegmentRes,
    byRegionRes,
    byFuelRes,
    makesRes,
    segmentsRes,
    fuelsRes,
  ] = await Promise.all([
    countQuery,
    volvoCountQuery,
    rowsQuery,
    rpcClient.rpc("pop_summary_by_make", rpcArgs),
    rpcClient.rpc("pop_summary_by_segment", rpcArgs),
    rpcClient.rpc("pop_summary_by_region", {
      p_segment: filters.segment,
      p_make: filters.make,
      p_hp: filters.hp,
      p_fuel: filters.fuel,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
      p_age: filters.age,
    }),
    rpcClient.rpc("pop_summary_by_fuel", {
      p_segment: filters.segment,
      p_make: filters.make,
      p_region: filters.region,
      p_hp: filters.hp,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
      p_age: filters.age,
    }),
    rpcClient.rpc("pop_summary_by_make", {
      p_segment: filters.segment,
      p_make: null,
      p_region: filters.region,
      p_hp: filters.hp,
      p_fuel: filters.fuel,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
      p_age: filters.age,
    }),
    rpcClient.rpc("pop_summary_by_segment", {
      p_segment: null,
      p_make: null,
      p_region: null,
      p_hp: null,
      p_fuel: null,
      p_pabygg: null,
      p_disp: null,
      p_chassis: null,
    }),
    rpcClient.rpc("pop_summary_by_fuel", {
      p_segment: filters.segment,
      p_make: filters.make,
      p_region: filters.region,
      p_hp: filters.hp,
      p_pabygg: filters.pabygg,
      p_disp: filters.disp,
      p_chassis: filters.chassis,
      p_age: filters.age,
    }),
  ]);

  const totalRows = countRes.count ?? 0;
  const volvoCount = volvoCountRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / POPULATION_PAGE_SIZE));

  return {
    filters,
    summary: {
      total: totalRows,
      volvoCount,
      volvoShare: totalRows > 0 ? (volvoCount / totalRows) * 100 : 0,
    },
    snapshotDate,
    segments: (segmentsRes.data ?? []).map((row) => row.segment),
    makes: (makesRes.data ?? []).map((row) => row.make_name),
    regions: REGION_FILTER_OPTIONS,
    hpBuckets: HP_BUCKET_FILTER_OPTIONS,
    fuels: [...new Set((fuelsRes.data ?? []).map((row) => row.fuel))],
    pabyggOptions: PABYGG_FILTER_OPTIONS,
    dispOptions: DISP_BUCKET_FILTER_OPTIONS,
    chassisOptions: CHASSIS_FILTER_OPTIONS,
    ageOptions: AGE_FILTER_OPTIONS,
    byMake: (byMakeRes.data ?? []).slice(0, 10),
    bySegment: bySegmentRes.data ?? [],
    byRegion: (byRegionRes.data ?? []).map((row) => ({
      region: row.region,
      label: getRegionLabel(row.region),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byFuel: byFuelRes.data ?? [],
    rows: rowsRes.data ?? [],
    totalRows,
    totalPages,
  };
}

const EXPORT_BATCH_SIZE = 1000;
const EXPORT_MAX_ROWS = 100000;

const POPULATION_EXPORT_COLUMNS =
  "registration_number, make_name, model_name, usage_name, maximum_laden_mass_kg, first_registration_date, vehicle_status, primary_owner_name, primary_owner_postal_code, primary_owner_postal_district, primary_user_name, primary_user_postal_code, primary_user_postal_district";

export async function getAllPopulationForExport(
  filters: PopulationFilters,
): Promise<PopulationRow[]> {
  const supabase = await createClient();

  const latestSnapshotRes = await supabase
    .from("population")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ snapshot_date: string }>();

  const snapshotDate = latestSnapshotRes.data?.snapshot_date ?? null;
  if (!snapshotDate) return [];

  const all: PopulationRow[] = [];

  for (let offset = 0; offset < EXPORT_MAX_ROWS; offset += EXPORT_BATCH_SIZE) {
    const batchQuery = applyPopulationFilters(
      supabase
        .from("population")
        .select(POPULATION_EXPORT_COLUMNS)
        .order("registration_number", { ascending: true })
        .range(offset, offset + EXPORT_BATCH_SIZE - 1),
      filters,
      snapshotDate,
    );

    const { data } = await batchQuery;
    const batch = (data ?? []) as unknown as PopulationRow[];
    all.push(...batch);

    if (batch.length < EXPORT_BATCH_SIZE) break;
  }

  return all;
}
