"use server";

import { getUserBrand } from "@/lib/brand/user-brand";
import { requirePageAccess } from "@/lib/auth/roles";
import { withFocusMake } from "@/lib/brand/focus-make";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { effectiveRegistrationDates } from "@/lib/registrations/period";
import type { TopBuyerRow } from "@/lib/registrations/queries";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BuyerLoyaltyType = "repeat" | "new" | "conquest";

export async function fetchBuyerLoyaltyOwners(
  filters: RegistrationsFilters,
  buyerType: BuyerLoyaltyType,
): Promise<{ owners: TopBuyerRow[]; error?: string }> {
  try {
    const user = await requirePageAccess("nyregistreringer");
    const focusMake = getUserBrand(user).makeName;
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const { from: rpcFrom, to: rpcTo } = effectiveRegistrationDates(filters);

    const { data, error } = await rpcClient.rpc(
      "reg_buyer_loyalty_owners",
      withFocusMake(
        {
          p_year: filters.year,
          p_buyer_type: buyerType,
          p_from: rpcFrom,
          p_to: rpcTo,
          p_segment: filters.segment,
          p_make: filters.make,
          p_month: filters.month,
          p_region: filters.region,
          p_hp: filters.hp,
          p_fuel: filters.fuel,
          p_pabygg: filters.pabygg,
          p_bodywork: filters.bodywork,
          p_disp: filters.disp,
          p_chassis: filters.chassis,
          p_limit: 100,
        },
        focusMake,
      ),
    );

    if (error) {
      return { owners: [], error: error.message };
    }

    return {
      owners: (data ?? []).map((row) => ({
        owner_name: row.owner_name,
        count: row.count,
        focus_count: row.focus_count,
      })),
    };
  } catch {
    return { owners: [], error: "Kunne ikke hente eierliste." };
  }
}
