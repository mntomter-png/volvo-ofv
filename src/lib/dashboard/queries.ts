import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  formatDate,
  formatMonthLabel,
  formatNumber,
  formatPercent,
} from "@/lib/format";

export { formatDate, formatMonthLabel, formatNumber, formatPercent };

export interface DashboardKpis {
  totalRegistrationsYtd: number;
  volvoRegistrationsYtd: number;
  volvoMarketShare: number;
  populationTotal: number;
  populationSnapshotDate: string | null;
  dataVersion: number | null;
  lastSyncedAt: string | null;
}

export interface MonthlyRegistration {
  month: string;
  count: number;
  label: string;
}

export interface MakeShare {
  make_name: string;
  count: number;
}

export interface SegmentShare {
  segment: string;
  count: number;
  volvo_count: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  registrationsByMonth: MonthlyRegistration[];
  registrationsByMake: MakeShare[];
  populationByMake: MakeShare[];
  registrationsBySegment: SegmentShare[];
  populationBySegment: SegmentShare[];
}

const HEAVY_TRUCK_MIN_KG = 16000;

export interface DashboardFilters {
  segment: string | null;
  region: number | null;
  pabygg: string | null;
}

interface FilterableQuery<Q> {
  eq: (column: string, value: string | number) => Q;
  gt: (column: string, value: string | number) => Q;
  gte: (column: string, value: string | number) => Q;
}

function applyDashboardRegistrationFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: DashboardFilters,
  yearStart: string,
): T {
  let q = query
    .eq("transaction_type_id", "10")
    .gt("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG)
    .gte("transaction_time", yearStart);
  if (filters.segment) q = q.eq("usage_name", filters.segment);
  if (filters.region) q = q.eq("sales_region", filters.region);
  if (filters.pabygg) q = q.eq("pabygg_segment", filters.pabygg);
  return q;
}

function applyDashboardPopulationFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: DashboardFilters,
  snapshotDate: string,
): T {
  let q = query
    .eq("snapshot_date", snapshotDate)
    .gt("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG);
  if (filters.segment) q = q.eq("usage_name", filters.segment);
  if (filters.region) q = q.eq("sales_region", filters.region);
  if (filters.pabygg) q = q.eq("pabygg_segment", filters.pabygg);
  return q;
}

export async function getDashboardData(
  filters: DashboardFilters = { segment: null, region: null, pabygg: null },
): Promise<DashboardData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01T00:00:00`;

  const totalRegistrationsQuery = applyDashboardRegistrationFilters(
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    filters,
    yearStart,
  );
  const totalRegistrationsRes = await totalRegistrationsQuery;

  const volvoRegistrationsQuery = applyDashboardRegistrationFilters(
    supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("make_name", "Volvo"),
    filters,
    yearStart,
  );
  const volvoRegistrationsRes = await volvoRegistrationsQuery;

  const latestSnapshotRes = await supabase
    .from("population")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ snapshot_date: string }>();

  const dashRpcArgs = {
    p_segment: filters.segment,
    p_region: filters.region,
    p_pabygg: filters.pabygg,
  };

  const monthlyRes = await rpcClient
    .rpc("dash_registrations_by_month", dashRpcArgs)
    .returns<{ month: string; count: number }[]>();

  const registrationsByMakeRes = await rpcClient
    .rpc("dash_registrations_by_make", dashRpcArgs)
    .returns<{ make_name: string; count: number }[]>();

  const populationByMakeRes = await rpcClient
    .rpc("dash_population_by_make", dashRpcArgs)
    .returns<{ make_name: string; count: number }[]>();

  const registrationsBySegmentRes = await supabase
    .from("dashboard_registrations_by_segment")
    .select("segment, count, volvo_count")
    .returns<SegmentShare[]>();

  const populationBySegmentRes = await supabase
    .from("dashboard_population_by_segment")
    .select("segment, count, volvo_count")
    .returns<SegmentShare[]>();

  const lastSyncRes = await supabase
    .from("sync_logs")
    .select("completed_at, ofv_publish_date, ofv_data_version")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      completed_at: string | null;
      ofv_publish_date: string | null;
      ofv_data_version: number | null;
    }>();

  const snapshotDate = latestSnapshotRes.data?.snapshot_date ?? null;

  let populationTotal = 0;
  if (snapshotDate) {
    const populationQuery = applyDashboardPopulationFilters(
      supabase.from("population").select("*", { count: "exact", head: true }),
      filters,
      snapshotDate,
    );
    const { count } = await populationQuery;
    populationTotal = count ?? 0;
  }

  const totalRegistrationsYtd = totalRegistrationsRes.count ?? 0;
  const volvoRegistrationsYtd = volvoRegistrationsRes.count ?? 0;

  return {
    kpis: {
      totalRegistrationsYtd,
      volvoRegistrationsYtd,
      volvoMarketShare:
        totalRegistrationsYtd > 0
          ? (volvoRegistrationsYtd / totalRegistrationsYtd) * 100
          : 0,
      populationTotal,
      populationSnapshotDate: snapshotDate,
      dataVersion: lastSyncRes.data?.ofv_data_version ?? null,
      lastSyncedAt: lastSyncRes.data?.completed_at ?? null,
    },
    registrationsByMonth: (monthlyRes.data ?? []).map((row) => ({
      month: row.month,
      count: row.count,
      label: formatMonthLabel(row.month),
    })),
    registrationsByMake: (registrationsByMakeRes.data ?? []).slice(0, 10),
    populationByMake: (populationByMakeRes.data ?? []).slice(0, 10),
    registrationsBySegment: registrationsBySegmentRes.data ?? [],
    populationBySegment: populationBySegmentRes.data ?? [],
  };
}
