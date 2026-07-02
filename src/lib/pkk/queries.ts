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

export interface PkkDueVehicleRow {
  owner_key: string;
  owner_name: string;
  focus_fleet_size: number;
  registration_number: string;
  model_name: string | null;
  first_registration_date: string | null;
  pkk_last_date: string | null;
  pkk_next_deadline: string | null;
  days_until_due: number | null;
}

export interface PkkPageData {
  fleetOwners: PkkFleetOwnerRow[];
  dueVehicles: PkkDueVehicleRow[];
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
    return { fleetOwners: [], dueVehicles: [], hasPkkDates: false, error: null };
  }

  const filterRpcArgs = {
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

  const [fleetRes, dueRes, pkkCountRes] = await Promise.all([
    rpcClient.rpc(
      "pop_pkk_fleet_owners",
      withFocusMake(
        { ...filterRpcArgs, p_min_volvo: 1, p_limit: 30 },
        focusMake,
      ),
    ),
    rpcClient.rpc(
      "pop_pkk_due_soon_vehicles",
      withFocusMake(
        {
          ...filterRpcArgs,
          p_months: 6,
          p_min_volvo: 1,
          p_owner_limit: 30,
          p_vehicle_limit: 500,
        },
        focusMake,
      ),
    ),
    supabase
      .from("population")
      .select("*", { count: "exact", head: true })
      .eq("snapshot_date", snapshotDate)
      .not("pkk_next_deadline", "is", null),
  ]);

  const error = fleetRes.error?.message ?? dueRes.error?.message ?? null;

  return {
    fleetOwners: (fleetRes.data ?? []).map((row) => ({
      owner_key: row.owner_key,
      owner_name: row.owner_name,
      focus_count: row.focus_count,
      total_count: row.total_count,
      pkk_due_count: row.pkk_due_count,
    })),
    dueVehicles: (dueRes.data ?? []).map((row) => ({
      owner_key: row.owner_key,
      owner_name: row.owner_name,
      focus_fleet_size: row.focus_fleet_size,
      registration_number: row.registration_number,
      model_name: row.model_name,
      first_registration_date: row.first_registration_date,
      pkk_last_date: row.pkk_last_date,
      pkk_next_deadline: row.pkk_next_deadline,
      days_until_due: row.days_until_due,
    })),
    hasPkkDates: (pkkCountRes.count ?? 0) > 0,
    error,
  };
}
