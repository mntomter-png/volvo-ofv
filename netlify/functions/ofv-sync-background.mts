import type { Context } from "@netlify/functions";

import { runOfvSync } from "@/lib/sync/run-ofv-sync";

type SyncScope = "full" | "registrations" | "population";

/**
 * Background-funksjon (opptil 15 min) som kjører OFV → Supabase-synk.
 * Trigges av scheduled-sync, men kan også kalles manuelt med riktig secret:
 *
 *   curl -X POST "$URL/.netlify/functions/ofv-sync-background" \
 *     -H "Authorization: Bearer $SYNC_SECRET" \
 *     -H "Content-Type: application/json" -d '{"scope":"full"}'
 */
export default async (req: Request, _context: Context) => {
  const secret = process.env.SYNC_SECRET;
  const auth = req.headers.get("authorization");

  // Background-funksjoner svarer alltid 202 til kaller, så denne sjekken
  // hindrer kun selve synken i å kjøre uten gyldig secret.
  if (!secret || auth !== `Bearer ${secret}`) {
    console.error("OFV-synk avvist: manglende eller ugyldig SYNC_SECRET");
    return;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    console.error("OFV-synk feilet:", message);
  }
};
