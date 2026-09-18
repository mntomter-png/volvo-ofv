"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertPageAccess } from "@/lib/auth/roles";
import { withFocusMake } from "@/lib/brand/focus-make";
import { getUserBrand } from "@/lib/brand/user-brand";
import { parseCustomerSearch } from "@/lib/ofv/customer-search";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/** Hvilken tabell forslagene skal hentes fra. */
export type CustomerSearchSource = "registrations" | "population";

export interface CustomerSuggestion {
  name: string;
  /** Kun satt når navnet har ett entydig org.nr. i datagrunnlaget. */
  orgnr: string | null;
  vehicleCount: number;
  focusCount: number;
}

const MAX_SUGGESTIONS = 8;

export interface CustomerSuggestionResult {
  suggestions: CustomerSuggestion[];
  /** Brukerens merke, slik at trefflisten kan tekste focusCount riktig. */
  focusMake?: string;
  error?: string;
}

export async function fetchCustomerSuggestions(input: {
  source: CustomerSearchSource;
  query: string;
  /** Kun for nyregistreringer – forslag utenfor valgt periode er ikke til hjelp. */
  year?: number | null;
  from?: string | null;
  to?: string | null;
}): Promise<CustomerSuggestionResult> {
  const search = parseCustomerSearch(input.query);
  if (!search) return { suggestions: [] };

  try {
    const isRegistrations = input.source === "registrations";
    const user = await assertPageAccess(
      isRegistrations ? "nyregistreringer" : "populasjon",
    );
    const focusMake = getUserBrand(user).makeName;
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;

    const { data, error } = isRegistrations
      ? await rpcClient.rpc(
          "reg_customer_suggestions",
          withFocusMake(
            {
              p_q: search,
              p_year: input.year ?? null,
              p_from: input.from ?? null,
              p_to: input.to ?? null,
              p_limit: MAX_SUGGESTIONS,
            },
            focusMake,
          ),
        )
      : await rpcClient.rpc(
          "pop_customer_suggestions",
          withFocusMake({ p_q: search, p_limit: MAX_SUGGESTIONS }, focusMake),
        );

    if (error) {
      return { suggestions: [], error: error.message };
    }

    return {
      focusMake,
      suggestions: (data ?? []).map((row) => ({
        name: row.name,
        orgnr: row.orgnr,
        vehicleCount: row.vehicle_count,
        focusCount: row.focus_count,
      })),
    };
  } catch {
    return { suggestions: [], error: "Kunne ikke hente kundeforslag." };
  }
}
