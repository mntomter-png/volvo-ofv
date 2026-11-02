"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { MFA_REQUIRED_MESSAGE } from "@/lib/auth/mfa";
import { assertFleetManager } from "@/lib/auth/roles";
import { normalizeOrgNr } from "@/lib/fleet/central-orgs";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface CentralFleetOrgActionResult {
  error?: string;
}

function safeOrgError(message: string, fallback: string): string {
  if (
    message === MFA_REQUIRED_MESSAGE ||
    message.startsWith("Du har ikke tilgang") ||
    message.includes("Ingen tilgang") ||
    message.includes("Org.nr") ||
    message.includes("Navn må") ||
    message.includes("Merknaden")
  ) {
    return message;
  }
  return fallback;
}

export async function saveCentralFleetOrg(input: {
  orgnr: string;
  name: string;
  note: string;
  active: boolean;
}): Promise<CentralFleetOrgActionResult> {
  try {
    await assertFleetManager();

    const orgnr = normalizeOrgNr(input.orgnr);
    const name = input.name.trim();
    const note = input.note.trim();

    if (!orgnr) {
      return { error: "Org.nr. må være 9 siffer." };
    }
    if (name.length < 2 || name.length > 200) {
      return { error: "Navn må være mellom 2 og 200 tegn." };
    }
    if (note.length > 500) {
      return { error: "Merknaden er for lang." };
    }

    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const { error } = await rpcClient.rpc("upsert_central_fleet_org", {
      p_orgnr: orgnr,
      p_name: name,
      p_note: note || null,
      p_active: input.active,
    });

    if (error) {
      console.error("[fleet] upsert_central_fleet_org:", error.message);
      return {
        error: safeOrgError(error.message, "Kunne ikke lagre organisasjonen."),
      };
    }

    revalidatePath("/nyregistreringer");
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return {
      error: safeOrgError(message, "Kunne ikke lagre organisasjonen."),
    };
  }
}

export async function removeCentralFleetOrg(
  orgnr: string,
): Promise<CentralFleetOrgActionResult> {
  try {
    await assertFleetManager();

    const normalized = normalizeOrgNr(orgnr);
    if (!normalized) {
      return { error: "Org.nr. må være 9 siffer." };
    }

    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const { error } = await rpcClient.rpc("delete_central_fleet_org", {
      p_orgnr: normalized,
    });

    if (error) {
      console.error("[fleet] delete_central_fleet_org:", error.message);
      return {
        error: safeOrgError(error.message, "Kunne ikke fjerne organisasjonen."),
      };
    }

    revalidatePath("/nyregistreringer");
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return {
      error: safeOrgError(message, "Kunne ikke fjerne organisasjonen."),
    };
  }
}
