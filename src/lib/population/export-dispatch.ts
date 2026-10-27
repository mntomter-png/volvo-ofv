import {
  POPULATION_EXPORT_FUNCTION,
  isUuid,
} from "@/lib/population/export-shared";
import {
  runFullPopulationExportJob,
  runPopulationExportJob,
} from "@/lib/population/export-supabase";

export interface PopulationExportDispatchEnv {
  NETLIFY?: string;
  URL?: string;
  DEPLOY_PRIME_URL?: string;
  SYNC_SECRET?: string;
}

export function populationExportBackgroundUrl(base: string): string {
  return `${base.replace(/\/$/, "")}/.netlify/functions/${POPULATION_EXPORT_FUNCTION}`;
}

async function postPopulationExportBackground(
  body: unknown,
  env: {
    URL?: string;
    DEPLOY_PRIME_URL?: string;
    SYNC_SECRET?: string;
  },
  fetchImpl: typeof fetch,
): Promise<void> {
  const secret = env.SYNC_SECRET;
  const base = env.URL || env.DEPLOY_PRIME_URL;
  if (!secret || !base) {
    throw new Error("Bakgrunnseksport er ikke konfigurert.");
  }
  const response = await fetchImpl(populationExportBackgroundUrl(base), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (response.status !== 202 && !response.ok) {
    throw new Error(`Kunne ikke starte eksport (${response.status}).`);
  }
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
    await postPopulationExportBackground(
      { jobId },
      {
        URL: env.URL,
        DEPLOY_PRIME_URL: env.DEPLOY_PRIME_URL,
        SYNC_SECRET: env.SYNC_SECRET,
      },
      deps?.fetchImpl ?? fetch,
    );
    return;
  }

  void runInline(jobId).catch((error) => {
    console.error(
      "[population-export]",
      error instanceof Error ? error.message : error,
    );
  });
}

/**
 * Starter forhåndsbygging av hele bestanden. På Netlify er kallet ferdig når
 * bakgrunnsfunksjonen har svart 202. Lokalt kan `wait` vente til filen er lagret,
 * slik at en synk-prosess ikke avsluttes midt i byggingen.
 */
export async function dispatchPopulationFullExport(
  options: { force: boolean; wait?: boolean },
  deps?: {
    env?: PopulationExportDispatchEnv;
    fetchImpl?: typeof fetch;
    runInline?: (options: { force: boolean }) => Promise<void>;
  },
): Promise<void> {
  const env = deps?.env ?? process.env;
  const runInline = deps?.runInline ?? runFullPopulationExportJob;
  const force = options.force === true;

  if (env.NETLIFY === "true") {
    await postPopulationExportBackground(
      { full: true, force },
      {
        URL: env.URL,
        DEPLOY_PRIME_URL: env.DEPLOY_PRIME_URL,
        SYNC_SECRET: env.SYNC_SECRET,
      },
      deps?.fetchImpl ?? fetch,
    );
    return;
  }

  const run = runInline({ force });
  if (options.wait) {
    await run;
    return;
  }
  void run.catch((error) => {
    console.error(
      "[population-export]",
      error instanceof Error ? error.message : error,
    );
  });
}
