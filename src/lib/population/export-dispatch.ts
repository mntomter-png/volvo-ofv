import {
  POPULATION_EXPORT_FUNCTION,
  isUuid,
} from "@/lib/population/export-shared";
import { runPopulationExportJob } from "@/lib/population/export-supabase";

export interface PopulationExportDispatchEnv {
  NETLIFY?: string;
  URL?: string;
  DEPLOY_PRIME_URL?: string;
  SYNC_SECRET?: string;
}

export function populationExportBackgroundUrl(base: string): string {
  return `${base.replace(/\/$/, "")}/.netlify/functions/${POPULATION_EXPORT_FUNCTION}`;
}

/**
 * På Netlify startes bakgrunnsfunksjonen (15 min). Lokalt kjører jobben i
 * samme prosess etter at HTTP-svaret er sendt.
 */
export async function dispatchPopulationExport(
  jobId: string,
  deps?: {
    env?: PopulationExportDispatchEnv;
    fetchImpl?: typeof fetch;
    runInline?: (jobId: string) => Promise<void>;
  },
): Promise<void> {
  if (!isUuid(jobId)) {
    throw new Error("Ugyldig jobb.");
  }

  const env = deps?.env ?? process.env;
  const runInline = deps?.runInline ?? runPopulationExportJob;

  if (env.NETLIFY === "true") {
    const secret = env.SYNC_SECRET;
    const base = env.URL || env.DEPLOY_PRIME_URL;
    if (!secret || !base) {
      throw new Error("Bakgrunnseksport er ikke konfigurert.");
    }
    const response = await (deps?.fetchImpl ?? fetch)(
      populationExportBackgroundUrl(base),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
      },
    );
    if (response.status !== 202 && !response.ok) {
      throw new Error(`Kunne ikke starte eksport (${response.status}).`);
    }
    return;
  }

  void runInline(jobId).catch((error) => {
    console.error(
      "[population-export]",
      error instanceof Error ? error.message : error,
    );
  });
}
