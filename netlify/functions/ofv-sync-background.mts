import type { Context } from "@netlify/functions";

import { verifyRequestBearerSecret } from "@/lib/auth/verify-secret";
import { runOfvSync } from "@/lib/sync/run-ofv-sync";

type SyncScope = "full" | "registrations" | "population";

/**
 * Background-funksjon (opptil 15 min) som kjører OFV → Supabase-synk.
 */
export default async (req: Request, _context: Context) => {
  if (!verifyRequestBearerSecret(req, process.env.SYNC_SECRET)) {
    console.error("OFV-synk avvist: manglende eller ugyldig SYNC_SECRET");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let scope: SyncScope = "full";
  let force = false;

  try {
    const body = (await req.json()) as { scope?: SyncScope; force?: boolean };
    if (body?.scope === "registrations" || body?.scope === "population") {
      scope = body.scope;
    }
    if (body?.force === true) force = true;
  } catch {
    // Tom body → standard scope (full).
  }

  try {
    const result = await runOfvSync({ scope, force });
    console.log("OFV-synk fullført:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    console.error("OFV-synk feilet:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
