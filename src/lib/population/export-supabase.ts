import { exportFilename } from "@/lib/export/excel";
import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";
import { createAdminClient } from "@/lib/supabase/admin-core";
import type { Json } from "@/lib/supabase/types";
import { runFullPopulationExport } from "@/lib/population/export-full";
import type { FullPopulationExportDeps } from "@/lib/population/export-full";
import {
  FULL_EXPORT_STALE_MS,
  fullExportClaimDecision,
  fullExportDispatchFailureAction,
  staleFullExportFailureMessage,
  POPULATION_EXPORT_BUCKET,
  POPULATION_EXPORT_PAGE_SIZE,
  POPULATION_EXPORT_URL_TTL_SECONDS,
  isSignablePopulationExportPath,
  populationExportStoragePath,
  populationFiltersToStored,
  type PopulationExportRow,
} from "@/lib/population/export-shared";
import { populationRowsToExcel } from "@/lib/population/export-workbook";
import type { PopulationFilters } from "@/lib/population/filters";
import {
  collectPopulationExportRows,
  runPopulationExport,
  type ClaimedPopulationExport,
  type PopulationExportDeps,
} from "@/lib/population/export-runner";

const STALE_RUNNING_MS = 20 * 60 * 1000;
const EXPORT_RETENTION_MS = 24 * 60 * 60 * 1000;

type Admin = ReturnType<typeof createAdminClient>;

function toClaimed(row: {
  id: string;
  user_id: string;
  filters: Json;
  snapshot_date: string | null;
}): ClaimedPopulationExport {
  return {
    id: row.id,
    userId: row.user_id,
    filters: row.filters,
    snapshotDate: row.snapshot_date,
  };
}

export function createSupabasePopulationExportDeps(
  admin: Admin = createAdminClient(),
): PopulationExportDeps {
  return {
    async claim(jobId) {
      const nowIso = new Date().toISOString();
      const queued = await admin
        .from("population_export_jobs")
        .update({ status: "running", updated_at: nowIso })
        .eq("id", jobId)
        .eq("status", "queued")
        .select("id, user_id, filters, snapshot_date")
        .maybeSingle();
      if (queued.error) throw new Error(queued.error.message);
      if (queued.data) return toClaimed(queued.data);

      const staleBefore = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
      const stale = await admin
        .from("population_export_jobs")
        .update({ status: "running", updated_at: nowIso })
        .eq("id", jobId)
        .eq("status", "running")
        .lt("updated_at", staleBefore)
        .select("id, user_id, filters, snapshot_date")
        .maybeSingle();
      if (stale.error) throw new Error(stale.error.message);
      return stale.data ? toClaimed(stale.data) : null;
    },

    async fetchPage(args) {
      const { data, error } = await admin.rpc("population_export_page", args);
      if (error) throw new Error(error.message);
      return (data ?? []) as PopulationExportRow[];
    },

    async updateProgress(jobId, rowsFetched) {
      const { error } = await admin
        .from("population_export_jobs")
        .update({
          rows_fetched: rowsFetched,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (error) throw new Error(error.message);
    },

    async upload(path, body) {
      const { error } = await admin.storage
        .from(POPULATION_EXPORT_BUCKET)
        .upload(path, Buffer.from(body), {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        });
      if (error) throw new Error(error.message);
      await deleteExpiredExports(admin, path);
    },

    async markReady(jobId, result) {
      const { error } = await admin
        .from("population_export_jobs")
        .update({
          status: "ready",
          row_count: result.rowCount,
          rows_fetched: result.rowCount,
          truncated: result.truncated,
          storage_path: result.storagePath,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (error) throw new Error(error.message);
    },

    async markFailed(jobId, message) {
      const { error } = await admin
        .from("population_export_jobs")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (error) throw new Error(error.message);
    },
  };
}

async function deleteExpiredExports(admin: Admin, currentPath: string): Promise<void> {
  const slash = currentPath.indexOf("/");
  if (slash <= 0) return;
  const userId = currentPath.slice(0, slash);
  const currentName = currentPath.slice(slash + 1);
  try {
    const { data, error } = await admin.storage
      .from(POPULATION_EXPORT_BUCKET)
      .list(userId, { limit: 100 });
    if (error || !data) return;
    const cutoff = Date.now() - EXPORT_RETENTION_MS;
    const stale = data.filter((file) => {
      if (file.name === currentName) return false;
      const created = file.created_at ? Date.parse(file.created_at) : Number.NaN;
      return Number.isFinite(created) && created < cutoff;
    });
    if (stale.length === 0) return;
    await admin.storage
      .from(POPULATION_EXPORT_BUCKET)
      .remove(stale.map((file) => `${userId}/${file.name}`));
  } catch (error) {
    console.error(
      "[population-export] cleanup",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function runPopulationExportJob(jobId: string): Promise<void> {
  await runPopulationExport(jobId, createSupabasePopulationExportDeps());
}

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface StoredFullPopulationExport {
  status: string;
  updatedAt: string;
  storagePath: string | null;
  rowsFetched: number;
  rowCount: number | null;
  truncated: boolean;
  errorMessage: string | null;
}

export async function readLatestPopulationSnapshot(
  admin: Admin = createAdminClient(),
): Promise<string | null> {
  const snapshotRes = await admin
    .from("population")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotRes.error) throw new Error(snapshotRes.error.message);
  return snapshotRes.data?.snapshot_date ?? null;
}

export async function readFullPopulationExport(
  snapshotDate: string,
  admin: Admin = createAdminClient(),
): Promise<StoredFullPopulationExport | null> {
  const { data, error } = await admin
    .from("population_full_exports")
    .select(
      "status, updated_at, storage_path, rows_fetched, row_count, truncated, error_message",
    )
    .eq("snapshot_date", snapshotDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    status: data.status,
    updatedAt: data.updated_at,
    storagePath: data.storage_path,
    rowsFetched: data.rows_fetched,
    rowCount: data.row_count,
    truncated: data.truncated,
    errorMessage: data.error_message,
  };
}

export async function signPopulationExportPath(
  path: string,
  admin: Admin = createAdminClient(),
): Promise<string> {
  if (!isSignablePopulationExportPath(path)) {
    throw new Error("Ugyldig eksportsti.");
  }
  const signed = await admin.storage
    .from(POPULATION_EXPORT_BUCKET)
    .createSignedUrl(path, POPULATION_EXPORT_URL_TTL_SECONDS, {
      download: exportFilename("bestand"),
    });
  const url = signed.data?.signedUrl;
  if (signed.error || !url) {
    throw new Error(signed.error?.message ?? "Kunne ikke lage nedlastingslenke.");
  }
  return url;
}

export function createSupabaseFullExportDeps(
  admin: Admin = createAdminClient(),
): FullPopulationExportDeps {
  return {
    async currentSnapshot() {
      return readLatestPopulationSnapshot(admin);
    },

    async claim(snapshotDate, force) {
      const existing = await admin
        .from("population_full_exports")
        .select("status, storage_path, updated_at")
        .eq("snapshot_date", snapshotDate)
        .maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      const row = existing.data;
      const decision = fullExportClaimDecision(
        row
          ? {
              status: row.status,
              updatedAt: row.updated_at,
              storagePath: row.storage_path,
            }
          : null,
        force,
        Date.now(),
      );
      if (decision === "ready") return "ready";
      if (decision === "busy") return "busy";

      const { error } = await admin.from("population_full_exports").upsert({
        snapshot_date: snapshotDate,
        status: "building",
        error_message: null,
        rows_fetched: 0,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return "claimed";
    },

    async fetchPage(args) {
      const { data, error } = await admin.rpc("population_export_page", args);
      if (error) throw new Error(error.message);
      return (data ?? []) as PopulationExportRow[];
    },

    async updateProgress(snapshotDate, rowsFetched) {
      const { error } = await admin
        .from("population_full_exports")
        .update({
          rows_fetched: rowsFetched,
          updated_at: new Date().toISOString(),
        })
        .eq("snapshot_date", snapshotDate);
      if (error) throw new Error(error.message);
    },

    async noteStage(snapshotDate, stage) {
      const { error } = await admin
        .from("population_full_exports")
        .update({
          error_message: stage.slice(0, 200),
          updated_at: new Date().toISOString(),
        })
        .eq("snapshot_date", snapshotDate)
        .eq("status", "building");
      if (error) throw new Error(error.message);
    },

    async upload(path, body, contentType) {
      const { error } = await admin.storage
        .from(POPULATION_EXPORT_BUCKET)
        .upload(path, Buffer.from(body), { contentType, upsert: true });
      if (error) throw new Error(error.message);
    },

    async markReady(snapshotDate, result) {
      const { error } = await admin
        .from("population_full_exports")
        .update({
          status: "ready",
          row_count: result.rowCount,
          rows_fetched: result.rowCount,
          truncated: result.truncated,
          storage_path: result.storagePath,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("snapshot_date", snapshotDate);
      if (error) throw new Error(error.message);
    },

    async markFailed(snapshotDate, message) {
      const { error } = await admin
        .from("population_full_exports")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("snapshot_date", snapshotDate);
      if (error) throw new Error(error.message);
    },

    async listFull() {
      const { data, error } = await admin.storage
        .from(POPULATION_EXPORT_BUCKET)
        .list("full", { limit: 100 });
      if (error) throw new Error(error.message);
      return (data ?? []).map((file) => file.name);
    },

    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await admin.storage
        .from(POPULATION_EXPORT_BUCKET)
        .remove(paths);
      if (error) throw new Error(error.message);
    },
  };
}

export async function runFullPopulationExportJob(options: {
  force: boolean;
}): Promise<void> {
  await runFullPopulationExport(createSupabaseFullExportDeps(), options);
}

/**
 * En bygging som ikke har oppdatert raden på 20 minutter er død.
 * Oppdateringen treffer bare hvis raden fortsatt er like gammel, så en ny
 * bygging som startet i mellomtiden ikke blir merket feilet.
 */
export async function failStaleFullPopulationExport(
  snapshotDate: string,
  admin: Admin = createAdminClient(),
  now = Date.now(),
): Promise<void> {
  const stored = await readFullPopulationExport(snapshotDate, admin);
  if (!stored) return;
  const message = staleFullExportFailureMessage(
    {
      status: stored.status,
      updatedAt: stored.updatedAt,
      errorMessage: stored.errorMessage,
    },
    now,
  );
  if (!message) return;
  const staleBefore = new Date(now - FULL_EXPORT_STALE_MS).toISOString();
  const { error } = await admin
    .from("population_full_exports")
    .update({
      status: "failed",
      error_message: message,
      updated_at: new Date(now).toISOString(),
    })
    .eq("snapshot_date", snapshotDate)
    .eq("status", "building")
    .lt("updated_at", staleBefore);
  if (error) throw new Error(error.message);
}

/**
 * Dispatch nådde ikke bakgrunnsfunksjonen. Skriv feilen på siste snapshot
 * slik at raden ikke blir stående i `building` uten forklaring.
 * En fil som allerede er klar, røres ikke.
 */
export async function markCurrentFullExportFailed(
  message: string,
  deps?: {
    currentSnapshot?: () => Promise<string | null>;
    read?: (
      snapshotDate: string,
    ) => Promise<{ status: string; storagePath: string | null } | null>;
    markFailed?: (snapshotDate: string, message: string) => Promise<void>;
  },
): Promise<void> {
  const currentSnapshot = deps?.currentSnapshot ?? (() => readLatestPopulationSnapshot());
  const snapshotDate = await currentSnapshot();
  if (!snapshotDate) {
    console.error("[population-export] ingen snapshot å merke som feilet");
    return;
  }

  const read =
    deps?.read ??
    (async (date: string) => {
      const stored = await readFullPopulationExport(date);
      return stored
        ? { status: stored.status, storagePath: stored.storagePath }
        : null;
    });
  const row = await read(snapshotDate);
  const text =
    message.replace(/\s+/g, " ").trim().slice(0, 200) ||
    "Eksporten feilet. Prøv igjen.";
  if (fullExportDispatchFailureAction(row) === "keep") {
    console.error(
      "[population-export] dispatch feilet, beholder klar fil",
      snapshotDate,
      text,
    );
    return;
  }

  const markFailed =
    deps?.markFailed ??
    (async (date: string, errorMessage: string) => {
      const admin = createAdminClient();
      const { error } = await admin.from("population_full_exports").upsert(
        {
          snapshot_date: date,
          status: "failed",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "snapshot_date" },
      );
      if (error) throw new Error(error.message);
    });
  await markFailed(snapshotDate, text);
  console.error("[population-export] dispatch feilet", snapshotDate, text);
}

async function failStalePopulationExportJobs(
  admin: Admin,
  userId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(Date.now() - FULL_EXPORT_STALE_MS).toISOString();
  await admin
    .from("population_export_jobs")
    .update({
      status: "failed",
      error_message: "Eksporten ble avbrutt.",
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .lt("updated_at", staleBefore);
}

export async function insertQueuedPopulationExportJob(
  admin: Admin,
  args: { userId: string; filters: PopulationFilters; snapshotDate: string },
): Promise<string> {
  await failStalePopulationExportJobs(admin, args.userId);
  const { data: job, error } = await admin
    .from("population_export_jobs")
    .insert({
      user_id: args.userId,
      status: "queued",
      filters: populationFiltersToStored(args.filters) as Json,
      snapshot_date: args.snapshotDate,
    })
    .select("id")
    .single();
  if (error || !job) {
    throw new Error(error?.message ?? "Kunne ikke opprette eksport.");
  }
  return job.id;
}

export async function markPopulationExportJobFailed(
  admin: Admin,
  jobId: string,
  message: string,
): Promise<void> {
  await admin
    .from("population_export_jobs")
    .update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function buildFilteredPopulationWorkbook(
  admin: Admin,
  args: { filters: PopulationFilters; snapshotDate: string; maxRows: number },
): Promise<{ bytes: Uint8Array; rowCount: number; truncated: boolean }> {
  const deps = createSupabasePopulationExportDeps(admin);
  const { rows } = await collectPopulationExportRows({
    fetchPage: deps.fetchPage,
    filters: args.filters,
    snapshotDate: args.snapshotDate,
    pageSize: POPULATION_EXPORT_PAGE_SIZE,
    maxRows: args.maxRows,
    now: new Date(),
  });
  const bytes = populationRowsToExcel(rows);
  if (!isCompleteXlsx(bytes)) {
    throw new Error("Eksporten ble ufullstendig.");
  }
  // maxRows er det telte antallet. En full siste side er da hele utvalget,
  // ikke et kutt mot 100 000.
  return {
    bytes,
    rowCount: rows.length,
    truncated: rows.length < args.maxRows,
  };
}

/**
 * Filen er for stor for det synkrone svaret. Lagre den og signer,
 * uten å bygge den på nytt i bakgrunnen.
 */
export async function publishFilteredPopulationExport(
  admin: Admin,
  args: {
    userId: string;
    filters: PopulationFilters;
    snapshotDate: string;
    bytes: Uint8Array;
    rowCount: number;
    truncated: boolean;
  },
): Promise<string> {
  await failStalePopulationExportJobs(admin, args.userId);
  const { data: job, error } = await admin
    .from("population_export_jobs")
    .insert({
      user_id: args.userId,
      status: "running",
      filters: populationFiltersToStored(args.filters) as Json,
      snapshot_date: args.snapshotDate,
      rows_fetched: args.rowCount,
    })
    .select("id")
    .single();
  if (error || !job) {
    throw new Error(error?.message ?? "Kunne ikke opprette eksport.");
  }

  const storagePath = populationExportStoragePath(args.userId, job.id);
  try {
    const uploaded = await admin.storage
      .from(POPULATION_EXPORT_BUCKET)
      .upload(storagePath, Buffer.from(args.bytes), {
        contentType: XLSX_CONTENT_TYPE,
        upsert: true,
      });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const { error: readyError } = await admin
      .from("population_export_jobs")
      .update({
        status: "ready",
        row_count: args.rowCount,
        rows_fetched: args.rowCount,
        truncated: args.truncated,
        storage_path: storagePath,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (readyError) throw new Error(readyError.message);
    return signPopulationExportPath(storagePath, admin);
  } catch (publishError) {
    await admin
      .from("population_export_jobs")
      .update({
        status: "failed",
        error_message: "Eksporten kunne ikke lagres.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    throw publishError;
  }
}
