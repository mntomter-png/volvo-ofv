import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface FleetVinRegistryInfo {
  vinCount: number;
  chassisCount: number;
  matchedCount: number;
  unregisteredCount: number;
  lastUploadedAt: string | null;
  lastSourceLabel: string | null;
}

export async function getFleetVinRegistryInfo(): Promise<FleetVinRegistryInfo> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;

  const { data, error } = await rpcClient.rpc("get_fleet_vin_registry_info");
  if (error) {
    return {
      vinCount: 0,
      chassisCount: 0,
      matchedCount: 0,
      unregisteredCount: 0,
      lastUploadedAt: null,
      lastSourceLabel: null,
    };
  }

  const row = data?.[0];
  return {
    vinCount: row?.vin_count ?? 0,
    chassisCount: row?.chassis_count ?? 0,
    matchedCount: row?.matched_count ?? 0,
    unregisteredCount: row?.unregistered_count ?? 0,
    lastUploadedAt: row?.last_uploaded_at ?? null,
    lastSourceLabel: row?.last_source_label ?? null,
  };
}
