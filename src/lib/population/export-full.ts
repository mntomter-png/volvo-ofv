import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";
import {
  FULL_POPULATION_EXPORT_KEEP,
  POPULATION_EXPORT_MAX_ROWS,
  POPULATION_EXPORT_PAGE_SIZE,
  fullExportObjectsToDelete,
  fullPopulationExportPath,
  populationExportFileTooLarge,
  type PopulationExportPageArgs,
  type PopulationExportRow,
} from "@/lib/population/export-shared";
import { buildPopulationStreamingXlsx } from "@/lib/population/export-workbook";
import {
  collectPopulationExportRows,
  exportFailureMessage,
  forEachPopulationExportPage,
  withTimeout,
} from "@/lib/population/export-runner";

export interface FullPopulationExportDeps {
  currentSnapshot(): Promise<string | null>;
  claim(
    snapshotDate: string,
    force: boolean,
  ): Promise<"claimed" | "ready" | "busy">;
  fetchPage(args: PopulationExportPageArgs): Promise<PopulationExportRow[]>;
  updateProgress?(snapshotDate: string, rowsFetched: number): Promise<void>;
  /** Synlig fase mens status fortsatt er `building`. */
  noteStage?(snapshotDate: string, stage: string): Promise<void>;
  upload(path: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Standard 10 min for henting og bygging, 60 s for opplasting. */
  buildTimeoutMs?: number;
  uploadTimeoutMs?: number;
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

    const detachAbort = attachExportAbortHandler(() =>
      deps.markFailed(snapshot, "Eksporten ble avbrutt."),
    );
    try {
      const built = await withTimeout(
        buildFullExportBytes(deps, snapshot),
        deps.buildTimeoutMs ?? 10 * 60_000,
        "Eksporten ble ikke ferdig bygget i tide.",
      );
      if (populationExportFileTooLarge(built.bytes.byteLength)) {
        throw new Error(
          `Eksporten er for stor (${built.bytes.byteLength} byte).`,
        );
      }
      if (!isCompleteXlsx(built.bytes)) {
        throw new Error("Eksporten ble ufullstendig.");
      }

      await noteExportStage(deps, snapshot, "Laster opp");
      const storagePath = fullPopulationExportPath(snapshot);
      await withTimeout(
        deps.upload(
          storagePath,
          built.bytes,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        deps.uploadTimeoutMs ?? 60_000,
        "Eksporten ble ikke lastet opp i tide.",
      );

      await deps.markReady(snapshot, {
        rowCount: built.rowCount,
        truncated: built.truncated,
        storagePath,
      });

      await deleteStaleFullExports(deps);

      console.log(
        `[population-export] full klar ${snapshot} rader=${built.rowCount} byte=${built.bytes.byteLength}`,
      );
      return "done";
    } finally {
      detachAbort();
    }
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

const UNFILTERED = {
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
} as const;

async function noteExportStage(
  deps: FullPopulationExportDeps,
  snapshotDate: string,
  stage: string,
): Promise<void> {
  if (!deps.noteStage) return;
  try {
    await deps.noteStage(snapshotDate, stage);
  } catch (error) {
    console.error(
      "[population-export] fase",
      error instanceof Error ? error.message : error,
    );
  }
}

async function buildFullExportBytes(
  deps: FullPopulationExportDeps,
  snapshot: string,
): Promise<{ bytes: Uint8Array; rowCount: number; truncated: boolean }> {
  const now = deps.now?.() ?? new Date();
  const pageSize = deps.pageSize ?? POPULATION_EXPORT_PAGE_SIZE;
  const maxRows = deps.maxRows ?? POPULATION_EXPORT_MAX_ROWS;
  const onProgress = async (rowsFetched: number) => {
    if (!deps.updateProgress) return;
    try {
      await deps.updateProgress(snapshot, rowsFetched);
    } catch (error) {
      console.error(
        "[population-export] progress",
        error instanceof Error ? error.message : error,
      );
    }
  };

  if (deps.buildWorkbook) {
    await noteExportStage(deps, snapshot, "Henter rader");
    const collected = await collectPopulationExportRows({
      fetchPage: deps.fetchPage,
      filters: UNFILTERED,
      snapshotDate: snapshot,
      pageSize,
      maxRows,
      now,
      onProgress,
    });
    return {
      bytes: deps.buildWorkbook(collected.rows),
      rowCount: collected.rows.length,
      truncated: collected.truncated,
    };
  }

  await noteExportStage(deps, snapshot, "Henter rader");
  let rowCount = 0;
  let truncated = false;
  const bytes = await buildPopulationStreamingXlsx(async (write) => {
    const result = await forEachPopulationExportPage({
      fetchPage: deps.fetchPage,
      filters: UNFILTERED,
      snapshotDate: snapshot,
      pageSize,
      maxRows,
      now,
      onProgress,
      onPage: async (page) => {
        for (const row of page) await write(row);
      },
    });
    rowCount = result.rowCount;
    truncated = result.truncated;
  });
  return { bytes, rowCount, truncated };
}

async function deleteStaleFullExports(deps: FullPopulationExportDeps): Promise<void> {
  if (!deps.listFull || !deps.remove) return;
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

/** Tidsavbrudd fra plattformen skal sette raden til `failed` før prosessen dør. */
export function attachExportAbortHandler(
  markFailed: () => Promise<void>,
  exit: (code: number) => void = (code) => process.exit(code),
): () => void {
  const onTerm = () => {
    console.error("[population-export] avbrutt");
    void markFailed().finally(() => exit(1));
  };
  process.once("SIGTERM", onTerm);
  return () => {
    process.off("SIGTERM", onTerm);
  };
}
