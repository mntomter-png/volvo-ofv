import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";
import {
  POPULATION_EXPORT_MAX_ROWS,
  POPULATION_EXPORT_PAGE_SIZE,
  isUuid,
  populationExportPageArgs,
  populationExportStoragePath,
  populationFiltersFromStored,
  type PopulationExportPageArgs,
  type PopulationExportRow,
} from "@/lib/population/export-shared";
import { populationRowsToExcel } from "@/lib/population/export-workbook";
import type { PopulationFilters } from "@/lib/population/filters";

export interface ClaimedPopulationExport {
  id: string;
  userId: string;
  filters: unknown;
  snapshotDate: string | null;
}

export interface PopulationExportDeps {
  claim(jobId: string): Promise<ClaimedPopulationExport | null>;
  fetchPage(args: PopulationExportPageArgs): Promise<PopulationExportRow[]>;
  updateProgress(jobId: string, rowsFetched: number): Promise<void>;
  upload(path: string, body: Uint8Array): Promise<void>;
  markReady(
    jobId: string,
    result: { rowCount: number; truncated: boolean; storagePath: string },
  ): Promise<void>;
  markFailed(jobId: string, message: string): Promise<void>;
  now?: () => Date;
  pageSize?: number;
  maxRows?: number;
  buildWorkbook?: (rows: PopulationExportRow[]) => Uint8Array;
}

export function exportFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Eksporten")) {
    return error.message.slice(0, 200);
  }
  return "Eksporten feilet. Prøv igjen.";
}

export async function collectPopulationExportRows(options: {
  fetchPage: (args: PopulationExportPageArgs) => Promise<PopulationExportRow[]>;
  filters: PopulationFilters;
  snapshotDate: string;
  pageSize: number;
  maxRows: number;
  now: Date;
  onProgress?: (rowsFetched: number) => Promise<void> | void;
}): Promise<{ rows: PopulationExportRow[]; truncated: boolean }> {
  const rows: PopulationExportRow[] = [];
  let after: string | null = null;
  let truncated = false;

  while (rows.length < options.maxRows) {
    const limit = Math.min(options.pageSize, options.maxRows - rows.length);
    const page = await options.fetchPage(
      populationExportPageArgs(
        options.filters,
        options.snapshotDate,
        after,
        limit,
        options.now,
      ),
    );
    if (page.length === 0) break;
    if (page.length > limit) {
      throw new Error("Eksporten fikk en for stor side.");
    }
    const last = page[page.length - 1]?.registration_number;
    if (!last || (after !== null && last <= after)) {
      throw new Error("Eksporten fikk ikke neste side.");
    }
    rows.push(...page);
    after = last;
    if (options.onProgress) {
      await options.onProgress(rows.length);
    }
    if (page.length < limit) break;
    if (rows.length >= options.maxRows) {
      truncated = true;
      break;
    }
  }

  return { rows, truncated };
}

/**
 * Henter bestanden med keyset, bygger en komplett xlsx og laster den opp.
 * Returnerer `skipped` når jobben allerede er tatt eller ikke finnes.
 */
export async function runPopulationExport(
  jobId: string,
  deps: PopulationExportDeps,
): Promise<"done" | "skipped"> {
  if (!isUuid(jobId)) {
    throw new Error("Ugyldig jobb.");
  }

  const job = await deps.claim(jobId);
  if (!job) return "skipped";

  const pageSize = deps.pageSize ?? POPULATION_EXPORT_PAGE_SIZE;
  const maxRows = deps.maxRows ?? POPULATION_EXPORT_MAX_ROWS;

  try {
    if (!job.snapshotDate) {
      throw new Error("Eksporten mangler bestandssnapshot.");
    }

    const filters = populationFiltersFromStored(job.filters);
    const now = deps.now?.() ?? new Date();
    const { rows, truncated } = await collectPopulationExportRows({
      fetchPage: deps.fetchPage,
      filters,
      snapshotDate: job.snapshotDate,
      pageSize,
      maxRows,
      now,
      onProgress: async (rowsFetched) => {
        try {
          await deps.updateProgress(jobId, rowsFetched);
        } catch (error) {
          console.error(
            "[population-export] progress",
            error instanceof Error ? error.message : error,
          );
        }
      },
    });

    const build = deps.buildWorkbook ?? populationRowsToExcel;
    const bytes = build(rows);
    if (!isCompleteXlsx(bytes)) {
      throw new Error("Eksporten ble ufullstendig.");
    }

    const storagePath = populationExportStoragePath(job.userId, job.id);
    await deps.upload(storagePath, bytes);
    await deps.markReady(jobId, {
      rowCount: rows.length,
      truncated,
      storagePath,
    });
    return "done";
  } catch (error) {
    console.error(
      "[population-export]",
      jobId,
      error instanceof Error ? error.message : error,
    );
    try {
      await deps.markFailed(jobId, exportFailureMessage(error));
    } catch (markError) {
      console.error(
        "[population-export] markFailed",
        markError instanceof Error ? markError.message : markError,
      );
    }
    return "done";
  }
}
