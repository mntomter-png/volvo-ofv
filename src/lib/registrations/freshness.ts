import { osloCalendarDate } from "@/lib/kpi/yoy";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RegistrationFreshness {
  /** Siste registreringsdato i Oslo, eller null når tabellen er tom. */
  dataThrough: string | null;
  /** En full- eller registreringssynk har status running. */
  syncRunning: boolean;
}

/**
 * Én liten RPC. Salg kan lese registreringer, men ikke sync_logs, så
 * «synk pågår» ligger i en security definer-funksjon som bare returnerer
 * et boolsk flagg.
 */
export async function getRegistrationFreshness(): Promise<RegistrationFreshness> {
  try {
    const supabase = await createClient();
    const rpc = supabase as unknown as SupabaseClient<Database>;
    const { data, error } = await rpc.rpc("reg_data_freshness");
    if (error) {
      console.error("[registrations] freshness:", error.message);
      return { dataThrough: null, syncRunning: false };
    }
    const row = data?.[0];
    const raw = row?.data_through ?? null;
    return {
      dataThrough: raw ? osloCalendarDate(new Date(raw)) : null,
      syncRunning: Boolean(row?.sync_running),
    };
  } catch (error) {
    console.error("[registrations] freshness:", error);
    return { dataThrough: null, syncRunning: false };
  }
}
