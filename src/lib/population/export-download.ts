import {
  isPopulationExportStatus,
  type PopulationExportStatusName,
} from "@/lib/population/export-shared";

export interface PopulationExportStatusBody {
  status: PopulationExportStatusName;
  rowsFetched: number;
  rowCount: number | null;
  truncated: boolean;
  error: string | null;
  downloadUrl: string | null;
}

const DEFAULT_TIMEOUT_MS = 12 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 2000;

export function openDownloadUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Poller jobbstatus og åpner den signerte URL-en når filen er klar.
 * Nettleseren laster ned direkte fra Storage, ikke via Netlify.
 */
export async function followPopulationExport(options: {
  jobId: string;
  statusUrl: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  intervalMs?: number;
  onProgress?: (rowsFetched: number, status: PopulationExportStatusName) => void;
  openUrl?: (url: string) => void;
}): Promise<{ truncated: boolean; rowCount: number | null }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const openUrl = options.openUrl ?? openDownloadUrl;
  const deadline = now() + timeoutMs;

  for (;;) {
    if (now() > deadline) {
      throw new Error("Eksporten tar for lang tid. Prøv igjen.");
    }

    const response = await fetchImpl(options.statusUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Eksport feilet (${response.status})`);
    }

    const body = (await response.json()) as Partial<PopulationExportStatusBody>;
    if (!isPopulationExportStatus(body.status)) {
      throw new Error("Eksporten svarte uventet.");
    }

    const rowsFetched = typeof body.rowsFetched === "number" ? body.rowsFetched : 0;
    options.onProgress?.(rowsFetched, body.status);

    if (body.status === "failed") {
      throw new Error(body.error || "Eksporten feilet. Prøv igjen.");
    }

    if (body.status === "ready") {
      if (!body.downloadUrl) {
        throw new Error("Eksporten mangler nedlastingslenke.");
      }
      openUrl(body.downloadUrl);
      return {
        truncated: body.truncated === true,
        rowCount: typeof body.rowCount === "number" ? body.rowCount : null,
      };
    }

    await sleep(intervalMs);
  }
}
