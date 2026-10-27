import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  requireApiPageAccess,
} from "@/lib/auth/api-access";
import {
  fullPopulationExportPath,
  isPopulationExportStatus,
  isUuid,
} from "@/lib/population/export-shared";
import {
  readFullPopulationExport,
  readLatestPopulationSnapshot,
  signPopulationExportPath,
} from "@/lib/population/export-supabase";
import { createAdminClient } from "@/lib/supabase/admin-core";

export const runtime = "nodejs";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const user = await requireApiPageAccess("populasjon");
    const params = new URL(request.url).searchParams;
    const admin = createAdminClient();

    if (params.get("full") === "1") {
      const snapshotDate = await readLatestPopulationSnapshot(admin);
      if (!snapshotDate) {
        return json({ error: "Ingen bestand å eksportere." }, 409);
      }
      const stored = await readFullPopulationExport(snapshotDate, admin);
      if (!stored || stored.status === "building") {
        return json({
          status: "running",
          rowsFetched: stored?.rowsFetched ?? 0,
          rowCount: null,
          truncated: false,
          error: null,
          downloadUrl: null,
        });
      }
      if (stored.status === "failed") {
        return json({
          status: "failed",
          rowsFetched: stored.rowsFetched,
          rowCount: stored.rowCount,
          truncated: false,
          error: stored.errorMessage ?? "Eksporten feilet. Prøv igjen.",
          downloadUrl: null,
        });
      }
      if (
        stored.status !== "ready" ||
        stored.storagePath !== fullPopulationExportPath(snapshotDate)
      ) {
        return json({
          status: "running",
          rowsFetched: stored.rowsFetched,
          rowCount: null,
          truncated: false,
          error: null,
          downloadUrl: null,
        });
      }
      const downloadUrl = await signPopulationExportPath(stored.storagePath, admin);
      return json({
        status: "ready",
        rowsFetched: stored.rowsFetched,
        rowCount: stored.rowCount,
        truncated: stored.truncated,
        error: null,
        downloadUrl,
      });
    }

    const id = params.get("id") ?? "";
    if (!isUuid(id)) {
      return json({ error: "Ugyldig eksport." }, 400);
    }

    const { data: job, error } = await admin
      .from("population_export_jobs")
      .select(
        "user_id, status, rows_fetched, row_count, truncated, error_message, storage_path",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) {
      return json({ error: "Fant ikke eksporten." }, 404);
    }
    if (!isPopulationExportStatus(job.status)) {
      throw new Error("Ukjent eksportstatus.");
    }

    let downloadUrl: string | null = null;
    if (job.status === "ready" && job.storage_path) {
      downloadUrl = await signPopulationExportPath(job.storage_path, admin);
    }

    return json({
      status: job.status,
      rowsFetched: job.rows_fetched,
      rowCount: job.row_count,
      truncated: job.truncated,
      error:
        job.status === "failed"
          ? (job.error_message ?? "Eksporten feilet. Prøv igjen.")
          : null,
      downloadUrl,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
