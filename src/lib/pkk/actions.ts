"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { getUserBrand } from "@/lib/brand/user-brand";
import { assertPageAccess } from "@/lib/auth/roles";
import type { PkkFilters } from "@/lib/pkk/filters";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface PkkOwnerVehicleRow {
  registration_number: string;
  make_name: string | null;
  model_name: string | null;
  first_registration_date: string | null;
  pkk_last_date: string | null;
  pkk_next_deadline: string | null;
  days_until_due: number | null;
}

export async function fetchPkkOwnerVehicles(
  filters: PkkFilters,
  ownerKey: string,
  includeNoDate = false,
): Promise<{ vehicles: PkkOwnerVehicleRow[]; error?: string }> {
  try {
    const user = await assertPageAccess("pkk");
    const focusMake = getUserBrand(user).makeName;
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;

    const { data, error } = await rpcClient.rpc(
      "pop_pkk_owner_vehicles",
      withFocusMake(
        {
          p_owner_key: ownerKey,
          p_region: filters.region,
          p_district: filters.district,
          p_months: 6,
          p_include_no_date: includeNoDate,
          p_horizon: filters.horizon,
          p_customer_party: filters.customerParty,
          p_limit: 200,
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
