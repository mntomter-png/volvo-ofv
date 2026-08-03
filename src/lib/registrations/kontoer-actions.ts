"use server";

import { getUserBrand } from "@/lib/brand/user-brand";
import { requirePageAccess } from "@/lib/auth/roles";
import { withFocusMake } from "@/lib/brand/focus-make";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { effectiveRegistrationDates } from "@/lib/registrations/period";
import {
  kontoerBucketLimit,
  type KontoerKpiBucket,
  type OwnerFocusDeclineRow,
} from "@/lib/registrations/kontoer-queries";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function parseStatus(value: string): OwnerFocusDeclineRow["status"] {
  if (
    value === "competitor" ||
    value === "mixed" ||
    value === "due" ||
    value === "overdue" ||
    value === "ok"
  ) {
    return value;
  }
  return "ok";
}

export async function fetchKontoerOwners(
  filters: RegistrationsFilters,
  bucket: KontoerKpiBucket,
  excludeFinance = true,
): Promise<{ rows: OwnerFocusDeclineRow[]; error?: string }> {
  try {
    const user = await requirePageAccess("nyregistreringer");
    const focusMake = getUserBrand(user).makeName;
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const { from, to } = effectiveRegistrationDates(filters);

    const { data, error } = await rpcClient.rpc(
      "reg_owner_focus_decline_list",
      withFocusMake(
        {
          p_year: filters.year,
          p_from: from,
          p_to: to,
          p_segment: filters.segment,
          p_region: filters.region,
          p_hp: filters.hp,
          p_fuel: filters.fuel,
          p_pabygg: filters.pabygg,
          p_bodywork: filters.bodywork,
          p_disp: filters.disp,
          p_chassis: filters.chassis,
          p_exclude_finance: excludeFinance,
          p_limit: kontoerBucketLimit(bucket),
          p_bucket: bucket,
        },
        focusMake,
      ),
    );

    if (error) {
      return { rows: [], error: error.message };
    }

    return {
      rows: (data ?? []).map((row) => ({
        ownerKey: row.owner_key,
        ownerName: row.owner_name,
        region: row.region,
        focus10y: row.focus_10y,
        fleetFocus: row.fleet_focus,
        fleetTotal: row.fleet_total,
        currentFocus: row.current_focus,
        currentTotal: row.current_total,
        competitorUnits: row.competitor_units,
        lastFocusDate: row.last_focus_date,
        yearsSinceLast: Number(row.years_since_last ?? 0),
        status: parseStatus(row.status),
        priorityScore: row.priority_score,
        sizeScore: row.size_score,
        signalScore: row.signal_score,
        recencyScore: row.recency_score,
      })),
    };
  } catch {
    return { rows: [], error: "Kunne ikke hente kontoliste." };
  }
}
