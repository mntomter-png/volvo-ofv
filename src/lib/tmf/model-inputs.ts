import { format, subYears } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import type { TmfMonthlyMarketRow } from "@/lib/tmf/types";

export type TmfSupabase = SupabaseClient<Database>;

/** Samme 8-års vindu som TMF-siden har brukt. */
export function tmfHistoryFrom(reference: Date): string {
  return format(subYears(reference, 8), "yyyy-MM-dd");
}

export async function fetchTmfMonthlyMarketRows(
  supabase: TmfSupabase,
  focusMake: string,
  reference: Date,
): Promise<TmfMonthlyMarketRow[]> {
  const { data, error } = await supabase.rpc("tmf_monthly_market", {
    p_from: tmfHistoryFrom(reference),
    p_to: null,
    p_focus_make: focusMake,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    month: row.month,
    pabygg: row.pabygg,
    count: row.count,
    volvo_count: row.volvo_count,
    emob_count: row.emob_count ?? 0,
    diesel_count: row.diesel_count ?? 0,
    gas_count: row.gas_count ?? 0,
    other_count: row.other_count ?? 0,
  }));
}
