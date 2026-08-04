import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

const SKIP_PREFIXES = ["/api/", "/auth/", "/_next/", "/login", "/glemt-passord"];

function shouldSkipPath(path: string): boolean {
  return SKIP_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix),
  );
}

/** Logger sidebesøk for innlogget bruker (throttles i DB, feiler stille). */
export async function trackPageVisit(pathname?: string): Promise<void> {
  try {
    let path = pathname?.trim() || "";
    if (!path) {
      const h = await headers();
      path = h.get("x-pathname")?.trim() || "";
    }
    if (!path || shouldSkipPath(path)) return;

    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    await supabase.rpc("record_page_visit", { p_path: path });
  } catch (error) {
    console.error(
      "[activity] trackPageVisit failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
