import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  formatDate,
  formatMonthLabel,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { shiftIsoDateByYears, ytdRegistrationRanges, type KpiYoYComparison } from "@/lib/kpi/yoy";

export { formatDate, formatMonthLabel, formatNumber, formatPercent };

export interface DashboardKpis {
  totalRegistrationsYtd: number;
  volvoRegistrationsYtd: number;
  volvoMarketShare: number;
  populationTotal: number;
  populationSnapshotDate: string | null;
  dataVersion: number | null;
  lastSyncedAt: string | null;
  registrationsYoy: KpiYoYComparison | null;
  populationYoy: KpiYoYComparison | null;
}

export interface MonthlyRegistration {
  month: string;
  count: number;
  volvo_count: number;
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
  error: string | null;
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
  lt: (column: string, value: string | number) => Q;
}

function applyDashboardRegistrationFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: DashboardFilters,
  from: string,
  toExclusive?: string,
): T {
  let q = query
    .eq("transaction_type_id", "10")
    .gte("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG)
    .gte("transaction_time", from);
  if (toExclusive) {
    q = q.lt("transaction_time", toExclusive);
  }
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
    .gte("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG);
  if (filters.segment) q = q.eq("usage_name", filters.segment);
  if (filters.region) q = q.eq("sales_region", filters.region);
  if (filters.pabygg) q = q.eq("pabygg_segment", filters.pabygg);
  return q;
}

async function fetchRegistrationSummaryInRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: DashboardFilters,
  from: string,
  toExclusive: string,
  focusMake: string,
): Promise<Pick<KpiYoYComparison, "total" | "volvoCount" | "volvoShare">> {
  const [countRes, volvoCountRes] = await Promise.all([
    applyDashboardRegistrationFilters(
      supabase.from("registrations").select("*", { count: "exact", head: true }),
      filters,
      from,
      toExclusive,
    ),
    applyDashboardRegistrationFilters(
      supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("make_name", focusMake),
      filters,
      from,
      toExclusive,
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

async function fetchPopulationSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: DashboardFilters,
  snapshotDate: string,
  focusMake: string,
): Promise<Pick<KpiYoYComparison, "total" | "volvoCount" | "volvoShare">> {
  const [countRes, volvoCountRes] = await Promise.all([
    applyDashboardPopulationFilters(
      supabase.from("population").select("*", { count: "exact", head: true }),
      filters,
      snapshotDate,
    ),
    applyDashboardPopulationFilters(
      supabase
        .from("population")
        .select("*", { count: "exact", head: true })
        .eq("make_name", focusMake),
      filters,
      snapshotDate,
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

async function findPreviousPopulationSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  latestSnapshot: string,
): Promise<string | null> {
  const targetDate = shiftIsoDateByYears(latestSnapshot.slice(0, 10), -1);
  const { data } = await supabase
    .from("population")
    .select("snapshot_date")
    .lte("snapshot_date", targetDate)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ snapshot_date: string }>();

  return data?.snapshot_date ?? null;
}

export async function getDashboardData(
  filters: DashboardFilters = { segment: null, region: null, pabygg: null },
  focusMake = "Volvo",
): Promise<DashboardData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;
  const ytdRanges = ytdRegistrationRanges();

  const [
    currentRegSummary,
    previousRegSummary,
    latestSnapshotRes,
    monthlyRes,
    registrationsByMakeRes,
    populationByMakeRes,
    registrationsBySegmentRes,
    populationBySegmentRes,
    lastSyncRes,
  ] = await Promise.all([
    fetchRegistrationSummaryInRange(
      supabase,
      filters,
      ytdRanges.current.from,
      ytdRanges.current.toExclusive,
      focusMake,
    ),
    ytdRanges.previous
      ? fetchRegistrationSummaryInRange(
          supabase,
          filters,
          ytdRanges.previous.from,
          ytdRanges.previous.toExclusive,
          focusMake,
        )
      : Promise.resolve(null),
    supabase
      .from("population")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle<{ snapshot_date: string }>(),
    rpcClient
      .rpc(
        "dash_registrations_by_month",
        withFocusMake(
          {
            p_segment: filters.segment,
            p_region: filters.region,
            p_pabygg: filters.pabygg,
          },
          focusMake,
        ),
      )
      .returns<{ month: string; count: number; volvo_count: number }[]>(),
    rpcClient
      .rpc("dash_registrations_by_make", {
        p_segment: filters.segment,
        p_region: filters.region,
        p_pabygg: filters.pabygg,
      })
      .returns<{ make_name: string; count: number }[]>(),
    rpcClient
      .rpc("dash_population_by_make", {
        p_segment: filters.segment,
        p_region: filters.region,
        p_pabygg: filters.pabygg,
      })
      .returns<{ make_name: string; count: number }[]>(),
    rpcClient
      .rpc(
        "dash_registrations_by_segment",
        withFocusMake(
          {
            p_segment: filters.segment,
            p_region: filters.region,
            p_pabygg: filters.pabygg,
          },
          focusMake,
        ),
      )
      .returns<SegmentShare[]>(),
    rpcClient
      .rpc(
        "dash_population_by_segment",
        withFocusMake(
          {
            p_segment: filters.segment,
            p_region: filters.region,
            p_pabygg: filters.pabygg,
          },
          focusMake,
        ),
      )
      .returns<SegmentShare[]>(),
    supabase
      .from("sync_logs")
      .select("completed_at, ofv_publish_date, ofv_data_version")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        completed_at: string | null;
        ofv_publish_date: string | null;
        ofv_data_version: number | null;
      }>(),
  ]);

  const snapshotDate = latestSnapshotRes.data?.snapshot_date ?? null;

  let populationSummary: Pick<
    KpiYoYComparison,
    "total" | "volvoCount" | "volvoShare"
  > = { total: 0, volvoCount: 0, volvoShare: 0 };
  let previousPopulationSummary: Pick<
    KpiYoYComparison,
    "total" | "volvoCount" | "volvoShare"
  > | null = null;
  let previousSnapshotDate: string | null = null;

  if (snapshotDate) {
    populationSummary = await fetchPopulationSummary(
      supabase,
      filters,
      snapshotDate,
      focusMake,
    );
    previousSnapshotDate = await findPreviousPopulationSnapshot(
      supabase,
      snapshotDate,
    );
    if (previousSnapshotDate) {
      previousPopulationSummary = await fetchPopulationSummary(
        supabase,
        filters,
        previousSnapshotDate,
        focusMake,
      );
    }
  }

  const totalRegistrationsYtd = currentRegSummary.total;
  const volvoRegistrationsYtd = currentRegSummary.volvoCount;

  const registrationsYoy =
    ytdRanges.previous && previousRegSummary
      ? {
          periodLabel: ytdRanges.previous.periodLabel,
          ...previousRegSummary,
        }
      : null;

  const populationYoy =
    previousSnapshotDate && previousPopulationSummary
      ? {
          periodLabel: formatDate(previousSnapshotDate),
          ...previousPopulationSummary,
        }
      : null;

  const error =
    monthlyRes.error?.message ??
    registrationsByMakeRes.error?.message ??
    populationByMakeRes.error?.message ??
    registrationsBySegmentRes.error?.message ??
    populationBySegmentRes.error?.message ??
    null;

  return {
    kpis: {
      totalRegistrationsYtd,
      volvoRegistrationsYtd,
      volvoMarketShare: currentRegSummary.volvoShare,
      populationTotal: populationSummary.total,
      populationSnapshotDate: snapshotDate,
      dataVersion: lastSyncRes.data?.ofv_data_version ?? null,
      lastSyncedAt: lastSyncRes.data?.completed_at ?? null,
      registrationsYoy,
      populationYoy,
    },
    registrationsByMonth: (monthlyRes.data ?? []).map((row) => ({
      month: row.month,
      count: row.count,
      volvo_count: row.volvo_count,
      label: formatMonthLabel(row.month),
    })),
    registrationsByMake: (registrationsByMakeRes.data ?? []).slice(0, 10),
    populationByMake: (populationByMakeRes.data ?? []).slice(0, 10),
    registrationsBySegment: registrationsBySegmentRes.data ?? [],
    populationBySegment: populationBySegmentRes.data ?? [],
    error,
  };
}
