"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { getUserBrand } from "@/lib/brand/user-brand";
import { requirePageAccess } from "@/lib/auth/roles";
import type { PopulationFilters } from "@/lib/population/filters";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface PkkOwnerVehicleRow {
  registration_number: string;
  make_name: string | null;
  model_name: string | null;
  first_registration_date: string | null;
  pkk_last_date: string | null;
  pkk_next_deadline: string | null;
}

export async function fetchPkkOwnerVehicles(
  filters: PopulationFilters,
  ownerKey: string,
): Promise<{ vehicles: PkkOwnerVehicleRow[]; error?: string }> {
  try {
    const user = await requirePageAccess("pkk");
    const focusMake = getUserBrand(user).makeName;
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;

    const { data, error } = await rpcClient.rpc(
      "pop_pkk_owner_vehicles",
      withFocusMake(
        {
          p_owner_key: ownerKey,
          p_segment: filters.segment,
          p_make: filters.make,
          p_region: filters.region,
          p_hp: filters.hp,
          p_fuel: filters.fuel,
          p_pabygg: filters.pabygg,
          p_disp: filters.disp,
          p_chassis: filters.chassis,
          p_age: filters.age,
          p_limit: 100,
        },
        focusMake,
      ),
    );

    if (error) {
      return { vehicles: [], error: error.message };
    }

    return { vehicles: data ?? [] };
  } catch {
    return { vehicles: [], error: "Kunne ikke hente kjøretøyliste." };
  }
}
