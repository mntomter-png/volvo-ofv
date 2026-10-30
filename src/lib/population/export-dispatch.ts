import {
  POPULATION_EXPORT_FUNCTION,
  isUuid,
} from "@/lib/population/export-shared";
import {
  runFullPopulationExportJob,
  runPopulationExportJob,
} from "@/lib/population/export-supabase";

export interface PopulationExportDispatchEnv {
  /** Byggetid. Netlify setter ikke denne i function-runtime. */
  NETLIFY?: string;
  /** Function-runtime: nettstedets primæradresse. */
  URL?: string;
  DEPLOY_PRIME_URL?: string;
  /** Function-runtime. Kan ikke overstyres lokalt. */
  SITE_ID?: string;
  SITE_NAME?: string;
  /** Lambda-kompatibilitet. Finnes ikke i lokal `next dev`. */
  AWS_LAMBDA_FUNCTION_NAME?: string;
  SYNC_SECRET?: string;
}

/**
 * Skal bakgrunnsfunksjonen bygge filen?
 *
 * `NETLIFY=true` finnes bare mens siden bygges, ikke når funksjonen kjører.
 * I runtime dokumenterer Netlify `URL`, `SITE_ID` og `SITE_NAME`.
 * `SYNC_SECRET` alene teller ikke: den ligger i lokal `.env` for synk-API-et.
 * Uten disse variablene bygges filen i prosessen (lokal utvikling).
 */
function readDispatchEnv(
  env?: PopulationExportDispatchEnv,
): PopulationExportDispatchEnv {
  const source = env ?? process.env;
  return {
    NETLIFY: source.NETLIFY,
    URL: source.URL,
    DEPLOY_PRIME_URL: source.DEPLOY_PRIME_URL,
    SITE_ID: source.SITE_ID,
    SITE_NAME: source.SITE_NAME,
    AWS_LAMBDA_FUNCTION_NAME: source.AWS_LAMBDA_FUNCTION_NAME,
    SYNC_SECRET: source.SYNC_SECRET,
  };
}

export function isNetlifyFunctionRuntime(
  env: PopulationExportDispatchEnv,
): boolean {
  if (env.NETLIFY === "true") return true;
  if (env.SITE_ID || env.SITE_NAME || env.AWS_LAMBDA_FUNCTION_NAME) return true;
  if (env.URL || env.DEPLOY_PRIME_URL) return true;
  return false;
}

export function populationExportBackgroundUrl(base: string): string {
  return `${base.replace(/\/$/, "")}/.netlify/functions/${POPULATION_EXPORT_FUNCTION}`;
}

/** Et hengende kall til bakgrunnsfunksjonen skal ikke holde synken. */
const BACKGROUND_DISPATCH_TIMEOUT_MS = 15_000;

async function postPopulationExportBackground(
  body: unknown,
  env: {
    URL?: string;
    DEPLOY_PRIME_URL?: string;
    SYNC_SECRET?: string;
  },
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<void> {
  const secret = env.SYNC_SECRET;
  const base = env.URL || env.DEPLOY_PRIME_URL;
  if (!secret || !base) {
    throw new Error("Bakgrunnseksport er ikke konfigurert.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(populationExportBackgroundUrl(base), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status !== 202 && !response.ok) {
      throw new Error(`Kunne ikke starte eksport (${response.status}).`);
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Bakgrunnseksport svarte ikke i tide.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
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
    backgroundTimeoutMs?: number;
  },
): Promise<void> {
  if (!isUuid(jobId)) {
    throw new Error("Ugyldig jobb.");
  }

  const env = readDispatchEnv(deps?.env);
  const runInline = deps?.runInline ?? runPopulationExportJob;

  if (isNetlifyFunctionRuntime(env)) {
    await postPopulationExportBackground(
      { jobId },
      {
        URL: env.URL,
        DEPLOY_PRIME_URL: env.DEPLOY_PRIME_URL,
        SYNC_SECRET: env.SYNC_SECRET,
      },
      deps?.fetchImpl ?? fetch,
      deps?.backgroundTimeoutMs ?? BACKGROUND_DISPATCH_TIMEOUT_MS,
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
    backgroundTimeoutMs?: number;
  },
): Promise<void> {
  const env = readDispatchEnv(deps?.env);
  const runInline = deps?.runInline ?? runFullPopulationExportJob;
  const force = options.force === true;

  if (isNetlifyFunctionRuntime(env)) {
    await postPopulationExportBackground(
      { full: true, force },
      {
        URL: env.URL,
        DEPLOY_PRIME_URL: env.DEPLOY_PRIME_URL,
        SYNC_SECRET: env.SYNC_SECRET,
      },
      deps?.fetchImpl ?? fetch,
      deps?.backgroundTimeoutMs ?? BACKGROUND_DISPATCH_TIMEOUT_MS,
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
