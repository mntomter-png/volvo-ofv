import { verifyRequestBearerSecret } from "@/lib/auth/verify-secret";
import { isUuid } from "@/lib/population/export-shared";
import {
  runFullPopulationExportJob,
  runPopulationExportJob,
} from "@/lib/population/export-supabase";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Netlify bakgrunnsfunksjon. Plattformen svarer 202 til kalleren med en gang;
 * selve filen bygges her, innenfor 15 minutter.
 */
export async function handlePopulationExportBackground(
  req: Request,
  deps?: {
    env?: { SYNC_SECRET?: string };
    run?: (jobId: string) => Promise<void>;
    runFull?: (options: { force: boolean }) => Promise<void>;
  },
): Promise<Response> {
  const env = deps?.env ?? process.env;
  if (!verifyRequestBearerSecret(req, env.SYNC_SECRET)) {
    console.error(
      "[population-export] avvist: manglende eller ugyldig SYNC_SECRET",
    );
    return json({ error: "Unauthorized" }, 401);
  }

  let jobId = "";
  let full = false;
  let force = true;
  try {
    const body = (await req.json()) as {
      jobId?: unknown;
      full?: unknown;
      force?: unknown;
    };
    if (body.full === true) {
      full = true;
      force = body.force !== false;
    } else if (typeof body.jobId === "string") {
      jobId = body.jobId;
    }
  } catch {
    jobId = "";
  }

  try {
    if (full) {
      console.log(`[population-export] starter full force=${force}`);
      const runFull = deps?.runFull ?? runFullPopulationExportJob;
      await runFull({ force });
      return json({ ok: true }, 200);
    }
    if (!isUuid(jobId)) {
      return json({ error: "Bad request" }, 400);
    }
    const run = deps?.run ?? runPopulationExportJob;
    await run(jobId);
    return json({ ok: true }, 200);
  } catch (error) {
    console.error(
      "[population-export]",
      error instanceof Error ? error.message : error,
    );
    return json({ error: "Eksport feilet" }, 500);
  }
}
