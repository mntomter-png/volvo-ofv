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

export async function getDashboardData(
  segment?: string | null,
): Promise<DashboardData> {
  const supabase = await createClient();
  // @supabase/ssr 0.5.x ships types built against an eldre supabase-js, som
  // bryter rpc()-argumentinferens. Bruk supabase-js sin klienttype for rpc.
  const rpcClient = supabase as unknown as SupabaseClient<Database>;
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01T00:00:00`;
  const segmentFilter = segment ?? null;

  let totalRegistrationsQuery = supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("transaction_type_id", "10")
    .gt("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG)
    .gte("transaction_time", yearStart);
  if (segmentFilter) {
    totalRegistrationsQuery = totalRegistrationsQuery.eq("usage_name", segmentFilter);
  }
  const totalRegistrationsRes = await totalRegistrationsQuery;

  let volvoRegistrationsQuery = supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("transaction_type_id", "10")
    .eq("make_name", "Volvo")
    .gt("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG)
    .gte("transaction_time", yearStart);
  if (segmentFilter) {
    volvoRegistrationsQuery = volvoRegistrationsQuery.eq("usage_name", segmentFilter);
  }
  const volvoRegistrationsRes = await volvoRegistrationsQuery;

  const latestSnapshotRes = await supabase
    .from("population")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ snapshot_date: string }>();

  const monthlyRes = await rpcClient
    .rpc("dash_registrations_by_month", { p_segment: segmentFilter })
    .returns<{ month: string; count: number }[]>();

  const registrationsByMakeRes = await rpcClient
    .rpc("dash_registrations_by_make", { p_segment: segmentFilter })
    .returns<{ make_name: string; count: number }[]>();

  const populationByMakeRes = await rpcClient
    .rpc("dash_population_by_make", { p_segment: segmentFilter })
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
    let populationQuery = supabase
      .from("population")
      .select("*", { count: "exact", head: true })
      .eq("snapshot_date", snapshotDate)
      .gt("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG);
    if (segmentFilter) {
      populationQuery = populationQuery.eq("usage_name", segmentFilter);
    }
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
