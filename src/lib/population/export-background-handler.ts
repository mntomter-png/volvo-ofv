import { verifyRequestBearerSecret } from "@/lib/auth/verify-secret";
import { isUuid } from "@/lib/population/export-shared";
import { runPopulationExportJob } from "@/lib/population/export-supabase";

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
  },
): Promise<Response> {
  const env = deps?.env ?? process.env;
  if (!verifyRequestBearerSecret(req, env.SYNC_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let jobId = "";
  try {
    const body = (await req.json()) as { jobId?: unknown };
    if (typeof body.jobId === "string") jobId = body.jobId;
  } catch {
    jobId = "";
  }
  if (!isUuid(jobId)) {
    return json({ error: "Bad request" }, 400);
  }

  const run = deps?.run ?? runPopulationExportJob;
  try {
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
