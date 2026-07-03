import type { JsonStat2Dataset } from "@/lib/ssb/types";

const SSB_BASE_URL = "https://data.ssb.no/api/pxwebapi/v2";
const SSB_FETCH_TIMEOUT_MS = 60_000;
const SSB_MAX_RETRIES = 3;
const SSB_REQUEST_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ssbFetch<T>(url: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= SSB_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SSB_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(`SSB API ${response.status}: ${text.slice(0, 500)}`);
        if (response.status >= 500 && attempt < SSB_MAX_RETRIES) {
          lastError = err;
          await sleep(attempt * 1000);
          continue;
        }
        throw err;
      }

      const data = (await response.json()) as T & { type?: string; title?: string };
      if (data.type === "Parameter error" || data.type === "Error") {
        throw new Error(`SSB API: ${data.title ?? data.type}`);
      }

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("SSB API-kall feilet");
      if (attempt < SSB_MAX_RETRIES) {
        lastError = err;
        await sleep(attempt * 1000);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("SSB API-kall feilet");
}

export function buildTableDataUrl(
  tableId: string,
  valuecodes: Record<string, string>,
): string {
  const params = new URLSearchParams({
    lang: "no",
    outputFormat: "json-stat2",
  });

  for (const [dimension, code] of Object.entries(valuecodes)) {
    params.append(`valuecodes[${dimension}]`, code);
  }

  return `${SSB_BASE_URL}/tables/${tableId}/data?${params.toString()}`;
}

export async function fetchTableData(
  tableId: string,
  valuecodes: Record<string, string>,
): Promise<JsonStat2Dataset> {
  const url = buildTableDataUrl(tableId, valuecodes);
  return ssbFetch<JsonStat2Dataset>(url);
}

/** Hent alle konfigurerte kilder med rate-limit-vennlig pause mellom kall. */
export async function fetchAllTableData(
  sources: { tableId: string; valuecodes: Record<string, string> }[],
): Promise<JsonStat2Dataset[]> {
  const results: JsonStat2Dataset[] = [];

  for (const source of sources) {
    if (results.length > 0) await sleep(SSB_REQUEST_DELAY_MS);
    results.push(await fetchTableData(source.tableId, source.valuecodes));
  }

  return results;
}
