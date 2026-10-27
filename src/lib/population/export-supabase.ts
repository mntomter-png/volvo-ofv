import { createAdminClient } from "@/lib/supabase/admin-core";
import type { Json } from "@/lib/supabase/types";
import {
  POPULATION_EXPORT_BUCKET,
  type PopulationExportRow,
} from "@/lib/population/export-shared";
import {
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
