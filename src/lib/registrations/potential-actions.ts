"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertPageAccess } from "@/lib/auth/roles";
import { withFocusMake } from "@/lib/brand/focus-make";
import { getUserBrand } from "@/lib/brand/user-brand";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface PotentialPartyBreakdownRow {
  section: "make" | "pabygg" | "bodywork";
  name: string;
  count: number;
  focusCount: number;
}

export interface PotentialPartyDetail {
  makes: PotentialPartyBreakdownRow[];
  pabygg: PotentialPartyBreakdownRow[];
  bodyworks: PotentialPartyBreakdownRow[];
  total: number;
}

function parseSection(
  value: string,
): PotentialPartyBreakdownRow["section"] | null {
  if (value === "make" || value === "pabygg" || value === "bodywork") {
    return value;
  }
  return null;
}

export async function fetchPotentialPartyDetail(
  partyKey: string,
): Promise<{ detail: PotentialPartyDetail | null; error?: string }> {
  try {
    const user = await assertPageAccess("nyregistreringer");
    const focusMake = getUserBrand(user).makeName;
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;

    const { data, error } = await rpcClient.rpc(
      "reg_potential_party_detail",
      withFocusMake(
        {
          p_party_key: partyKey,
          p_customer_party: "user",
          p_lookback_years: 10,
        },
        focusMake,
      ),
    );

    if (error) {
      return { detail: null, error: error.message };
    }

    const makes: PotentialPartyBreakdownRow[] = [];
    const pabygg: PotentialPartyBreakdownRow[] = [];
    const bodyworks: PotentialPartyBreakdownRow[] = [];

    for (const row of data ?? []) {
      const section = parseSection(row.section);
      if (!section) continue;
      const mapped: PotentialPartyBreakdownRow = {
        section,
        name: row.name,
        count: row.count,
        focusCount: row.focus_count,
      };
      if (section === "make") makes.push(mapped);
      else if (section === "pabygg") pabygg.push(mapped);
      else bodyworks.push(mapped);
    }

    const total = makes.reduce((sum, row) => sum + row.count, 0);

    return {
      detail: { makes, pabygg, bodyworks, total },
    };
  } catch {
    return { detail: null, error: "Kunne ikke hente kundedetaljer." };
  }
}
