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
  /**
   * Primæradresse. I produksjon er dette det egendefinerte domenet
   * (app.biloversikt.com), som ligger bak Cloudflare og svarer 403 på
   * server-til-server-kall. Ikke bruk den mot `/.netlify/functions`.
   */
  URL?: string;
  /** Alltid `*.netlify.app` for dette deployet, også i produksjon. */
  DEPLOY_PRIME_URL?: string;
  DEPLOY_URL?: string;
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
    DEPLOY_URL: source.DEPLOY_URL,
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

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isFunctionHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".netlify.app")
  );
}

/**
 * Vert som faktisk når Netlify-funksjonen.
 *
 * `URL` er custom domain når det er satt, og Cloudflare utfordrer kall uten
 * nettleser (403). `DEPLOY_PRIME_URL` peker på `*.netlify.app`, samme vert
 * som pg_cron bruker. Uten den bygger vi `https://<SITE_NAME>.netlify.app`.
 */
export function populationExportFunctionBase(
  env: PopulationExportDispatchEnv,
): string | null {
  for (const candidate of [env.DEPLOY_PRIME_URL, env.DEPLOY_URL, env.URL]) {
    if (!candidate) continue;
    const host = hostOf(candidate);
    if (host && isFunctionHost(host)) return candidate;
  }
  const site = env.SITE_NAME?.trim();
  if (site && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(site)) {
    return `https://${site}.netlify.app`;
  }
  return null;
}

/** Et hengende kall til bakgrunnsfunksjonen skal ikke holde synken. */
const BACKGROUND_DISPATCH_TIMEOUT_MS = 15_000;

async function postPopulationExportBackground(
  body: unknown,
  env: PopulationExportDispatchEnv,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<void> {
  const secret = env.SYNC_SECRET;
  const base = populationExportFunctionBase(env);
  if (!secret || !base) {
    throw new Error("Bakgrunnseksport er ikke konfigurert.");
  }
  const url = populationExportBackgroundUrl(base);
  const host = hostOf(url) ?? "ukjent vert";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      // Ikke følg 301 til custom domain: det stripper Authorization og treffer Cloudflare.
      redirect: "manual",
    });
    if (response.status !== 202) {
      throw new Error(`Kunne ikke starte eksport (${response.status}) mot ${host}.`);
    }
    console.log(`[population-export] bakgrunnsfunksjon svarte 202 (${host})`);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Bakgrunnseksport svarte ikke i tide (${host}).`);
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
      env,
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
      env,
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
