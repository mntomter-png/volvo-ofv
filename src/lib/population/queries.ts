import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { MakeShare, SegmentShare } from "@/lib/dashboard/queries";
import { POPULATION_PAGE_SIZE } from "@/lib/population/constants";
import {
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

export interface PopulationPageData {
  filters: PopulationFilters;
  summary: PopulationSummary;
  snapshotDate: string | null;
  segments: string[];
  makes: string[];
  byMake: MakeShare[];
  bySegment: SegmentShare[];
  rows: PopulationRow[];
  totalRows: number;
  totalPages: number;
}

interface FilterableQuery<Q> {
  eq: (column: string, value: string | number) => Q;
  gt: (column: string, value: string | number) => Q;
}

function applyPopulationFilters<T extends FilterableQuery<T>>(
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
      byMake: [],
      bySegment: [],
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

  const [countRes, volvoCountRes, rowsRes, byMakeRes, bySegmentRes, makesRes] =
    await Promise.all([
      countQuery,
      volvoCountQuery,
      rowsQuery,
      rpcClient.rpc("pop_summary_by_make", {
        p_segment: filters.segment,
        p_make: filters.make,
      }),
      rpcClient.rpc("pop_summary_by_segment", {
        p_segment: filters.segment,
        p_make: filters.make,
      }),
      rpcClient.rpc("pop_summary_by_make", {
        p_segment: filters.segment,
        p_make: null,
      }),
    ]);

  const segmentsRes = await rpcClient.rpc("pop_summary_by_segment", {
    p_segment: null,
    p_make: null,
  });

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
    byMake: (byMakeRes.data ?? []).slice(0, 10),
    bySegment: bySegmentRes.data ?? [],
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
