import type { Context } from "@netlify/functions";

import { verifyRequestBearerSecret } from "@/lib/auth/verify-secret";
import { runSsbSync } from "@/lib/sync/run-ssb-sync";

/**
 * Background-funksjon som kjører SSB → Supabase-synk.
 */
export default async (req: Request, _context: Context) => {
  if (!verifyRequestBearerSecret(req, process.env.SYNC_SECRET)) {
    console.error("SSB-synk avvist: manglende eller ugyldig SYNC_SECRET");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await runSsbSync();
    console.log("SSB-synk fullført:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    console.error("SSB-synk feilet:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
