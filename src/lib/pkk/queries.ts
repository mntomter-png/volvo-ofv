import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { PopulationFilters } from "@/lib/population/filters";

export interface PkkFleetOwnerRow {
  owner_key: string;
  owner_name: string;
  focus_count: number;
  total_count: number;
  pkk_due_count: number;
}

export interface PkkPageData {
  fleetOwners: PkkFleetOwnerRow[];
  hasPkkDates: boolean;
  error: string | null;
}

/** Henter PKK-oppfølging for største fokusmerke-flåter. */
export async function getPkkPageData(
  filters: PopulationFilters,
  focusMake: string,
): Promise<PkkPageData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;

  const { data: snapshotRow } = await supabase
    .from("population")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ snapshot_date: string }>();

  const snapshotDate = snapshotRow?.snapshot_date ?? null;
  if (!snapshotDate) {
    return { fleetOwners: [], hasPkkDates: false, error: null };
  }

  const [fleetRes, pkkSampleRes] = await Promise.all([
    rpcClient.rpc(
      "pop_pkk_fleet_owners",
      withFocusMake(
        {
          p_segment: filters.segment,
          p_make: filters.make,
          p_region: filters.region,
          p_hp: filters.hp,
          p_fuel: filters.fuel,
          p_pabygg: filters.pabygg,
          p_disp: filters.disp,
          p_chassis: filters.chassis,
          p_age: filters.age,
          p_min_volvo: 1,
          p_limit: 30,
        },
        focusMake,
      ),
    ),
    supabase
      .from("population")
      .select("pkk_next_deadline")
      .eq("snapshot_date", snapshotDate)
      .not("pkk_next_deadline", "is", null)
      .limit(1),
  ]);

  return {
    fleetOwners: (fleetRes.data ?? []).map((row) => ({
      owner_key: row.owner_key,
      owner_name: row.owner_name,
      focus_count: row.focus_count,
      total_count: row.total_count,
      pkk_due_count: row.pkk_due_count,
    })),
    hasPkkDates: (pkkSampleRes.data?.length ?? 0) > 0,
    error: fleetRes.error?.message ?? null,
  };
}
