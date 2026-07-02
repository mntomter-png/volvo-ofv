import type {
  OfvCreateRequestResponse,
  OfvRequestDescription,
  OfvStatusResponse,
  OfvVehiclesResponse,
} from "@/lib/ofv/types";

function getConfig() {
  const baseUrl = process.env.OFV_API_BASE_URL;
  const username = process.env.OFV_API_USERNAME;
  const password = process.env.OFV_API_PASSWORD;

  if (!baseUrl || !username || !password) {
    throw new Error(
      "OFV API-konfigurasjon mangler (OFV_API_BASE_URL, OFV_API_USERNAME, OFV_API_PASSWORD)",
    );
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), username, password };
}

const OFV_FETCH_TIMEOUT_MS = 120_000;
const OFV_MAX_RETRIES = 3;

function authHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

async function ofvFetch<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: string },
): Promise<T> {
  const { baseUrl, username, password } = getConfig();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= OFV_MAX_RETRIES; attempt++) {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", authHeader(username, password));
    headers.set("Accept", "application/json");
    headers.set("Accept-Language", "nb-NO");

    let body: string | undefined;
    if (init?.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = init.body;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OFV_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(`OFV API ${response.status}: ${text.slice(0, 500)}`);
        if (response.status >= 500 && attempt < OFV_MAX_RETRIES) {
          lastError = err;
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }
        throw err;
      }

      return (await response.json()) as T;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("OFV API-kall feilet");
      if (attempt < OFV_MAX_RETRIES) {
        lastError = err;
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("OFV API-kall feilet");
}

export async function getOfvStatus(): Promise<OfvStatusResponse> {
  return ofvFetch<OfvStatusResponse>("/status");
}

export async function createVehicleRequest(
  description: OfvRequestDescription,
): Promise<OfvCreateRequestResponse> {
  return ofvFetch<OfvCreateRequestResponse>("/vehicles/requests", {
    method: "POST",
    body: JSON.stringify(description),
  });
}

export async function fetchVehicleResults(
  handle: string,
  count: number,
  offset: number,
): Promise<OfvVehiclesResponse> {
  const params = new URLSearchParams({
    count: String(count),
    offset: String(offset),
  });
  return ofvFetch<OfvVehiclesResponse>(
    `/vehicles/requests/${handle}/result?${params}`,
  );
}

export async function* paginateVehicleResults(
  handle: string,
  pageSize: number,
): AsyncGenerator<OfvVehiclesResponse> {
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const page = await fetchVehicleResults(handle, pageSize, offset);
    total = page.totalNumberOfVehicles;
    yield page;
    offset += page.vehicles.length;
    if (page.vehicles.length === 0) break;
  }
}
