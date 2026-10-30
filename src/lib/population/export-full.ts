import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";
import {
  FULL_POPULATION_EXPORT_KEEP,
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

/**
 * Bygger hele bestanden (ingen sidefiltre) til `full/<snapshot>.xlsx`.
 * Statusraden i `population_full_exports` er pekeren. Bucketen tillater bare
 * regneark, så `full/latest.json` lastes ikke opp.
 * Hopper over når filen allerede er klar eller en bygging pågår, med mindre
 * `force` er satt. Feil, også fra claim, skrives på raden.
 */
export async function runFullPopulationExport(
  deps: FullPopulationExportDeps,
  options: { force?: boolean } = {},
): Promise<"done" | "skipped"> {
  const force = options.force === true;
  let snapshotDate: string | null = null;

  try {
    snapshotDate = await deps.currentSnapshot();
    if (!snapshotDate) {
      throw new Error("Eksporten mangler bestandssnapshot.");
    }
    const snapshot = snapshotDate;

    const claim = await deps.claim(snapshot, force);
    if (claim !== "claimed") return "skipped";

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
      snapshotDate: snapshot,
      pageSize: deps.pageSize ?? POPULATION_EXPORT_PAGE_SIZE,
      maxRows: deps.maxRows ?? POPULATION_EXPORT_MAX_ROWS,
      now,
      onProgress: async (rowsFetched) => {
        if (!deps.updateProgress) return;
        try {
          await deps.updateProgress(snapshot, rowsFetched);
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

    const storagePath = fullPopulationExportPath(snapshot);
    await deps.upload(
      storagePath,
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    await deps.markReady(snapshot, {
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

    console.log(
      `[population-export] full klar ${snapshot} rader=${rows.length}`,
    );
    return "done";
  } catch (error) {
    const message = exportFailureMessage(error);
    console.error("[population-export]", snapshotDate ?? "ukjent snapshot", message);
    if (snapshotDate) {
      try {
        await deps.markFailed(snapshotDate, message);
      } catch (markError) {
        console.error(
          "[population-export] markFailed",
          markError instanceof Error ? markError.message : markError,
        );
      }
    }
    return "done";
  }
}
