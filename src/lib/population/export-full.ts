import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";
import {
  FULL_POPULATION_EXPORT_KEEP,
  FULL_POPULATION_EXPORT_POINTER,
  POPULATION_EXPORT_MAX_ROWS,
  POPULATION_EXPORT_PAGE_SIZE,
  fullExportObjectsToDelete,
  fullPopulationExportPath,
  type PopulationExportPageArgs,
  type PopulationExportRow,
} from "@/lib/population/export-shared";
import { populationRowsToExcel } from "@/lib/population/export-workbook";
import {
  collectPopulationExportRows,
  exportFailureMessage,
} from "@/lib/population/export-runner";

export interface FullPopulationExportDeps {
  currentSnapshot(): Promise<string | null>;
  claim(
    snapshotDate: string,
    force: boolean,
  ): Promise<"claimed" | "ready" | "busy">;
  fetchPage(args: PopulationExportPageArgs): Promise<PopulationExportRow[]>;
  updateProgress?(snapshotDate: string, rowsFetched: number): Promise<void>;
  upload(path: string, body: Uint8Array, contentType: string): Promise<void>;
  markReady(
    snapshotDate: string,
    result: { rowCount: number; truncated: boolean; storagePath: string },
  ): Promise<void>;
  markFailed(snapshotDate: string, message: string): Promise<void>;
  listFull?: () => Promise<string[]>;
  remove?: (paths: string[]) => Promise<void>;
  now?: () => Date;
  pageSize?: number;
  maxRows?: number;
  buildWorkbook?: (rows: PopulationExportRow[]) => Uint8Array;
}

export interface FullExportPointer {
  snapshotDate: string;
  path: string;
  rowCount: number;
  truncated: boolean;
  builtAt: string;
}

/**
 * Bygger hele bestanden (ingen sidefiltre) til `full/<snapshot>.xlsx`
 * og oppdaterer `full/latest.json`. Hopper over når filen allerede er klar
 * eller en bygging pågår, med mindre `force` er satt.
 */
export async function runFullPopulationExport(
  deps: FullPopulationExportDeps,
  options: { force?: boolean } = {},
): Promise<"done" | "skipped"> {
  const force = options.force === true;
  const snapshotDate = await deps.currentSnapshot();
  if (!snapshotDate) {
    throw new Error("Eksporten mangler bestandssnapshot.");
  }

  const claim = await deps.claim(snapshotDate, force);
  if (claim !== "claimed") return "skipped";

  try {
    const now = deps.now?.() ?? new Date();
    const { rows, truncated } = await collectPopulationExportRows({
      fetchPage: deps.fetchPage,
      filters: {
        segment: null,
        make: null,
        page: 1,
        region: null,
        district: null,
        hp: null,
        fuel: null,
        pabygg: null,
        bodywork: null,
        disp: null,
        chassis: null,
        age: null,
        search: null,
      },
      snapshotDate,
      pageSize: deps.pageSize ?? POPULATION_EXPORT_PAGE_SIZE,
      maxRows: deps.maxRows ?? POPULATION_EXPORT_MAX_ROWS,
      now,
      onProgress: async (rowsFetched) => {
        if (!deps.updateProgress) return;
        try {
          await deps.updateProgress(snapshotDate, rowsFetched);
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

    const storagePath = fullPopulationExportPath(snapshotDate);
    await deps.upload(
      storagePath,
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const pointer: FullExportPointer = {
      snapshotDate,
      path: storagePath,
      rowCount: rows.length,
      truncated,
      builtAt: now.toISOString(),
    };
    await deps.upload(
      FULL_POPULATION_EXPORT_POINTER,
      new TextEncoder().encode(JSON.stringify(pointer)),
      "application/json",
    );

    await deps.markReady(snapshotDate, {
      rowCount: rows.length,
      truncated,
      storagePath,
    });

    if (deps.listFull && deps.remove) {
      try {
        const stale = fullExportObjectsToDelete(
          await deps.listFull(),
          FULL_POPULATION_EXPORT_KEEP,
        );
        if (stale.length > 0) await deps.remove(stale);
      } catch (error) {
        console.error(
          "[population-export] cleanup",
          error instanceof Error ? error.message : error,
        );
      }
    }

    return "done";
  } catch (error) {
    console.error(
      "[population-export]",
      snapshotDate,
      error instanceof Error ? error.message : error,
    );
    try {
      await deps.markFailed(snapshotDate, exportFailureMessage(error));
    } catch (markError) {
      console.error(
        "[population-export] markFailed",
        markError instanceof Error ? markError.message : markError,
      );
    }
    return "done";
  }
}
