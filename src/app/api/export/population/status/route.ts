import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  requireApiPageAccess,
} from "@/lib/auth/api-access";
import { exportFilename } from "@/lib/export/excel";
import {
  POPULATION_EXPORT_BUCKET,
  POPULATION_EXPORT_URL_TTL_SECONDS,
  isPopulationExportStatus,
  isUuid,
} from "@/lib/population/export-shared";
import { createAdminClient } from "@/lib/supabase/admin-core";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireApiPageAccess("populasjon");
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Ugyldig eksport." }, { status: 400 });
    }

    const admin = createAdminClient();
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
      return NextResponse.json({ error: "Fant ikke eksporten." }, { status: 404 });
    }
    if (!isPopulationExportStatus(job.status)) {
      throw new Error("Ukjent eksportstatus.");
    }

    let downloadUrl: string | null = null;
    if (job.status === "ready" && job.storage_path) {
      const signed = await admin.storage
        .from(POPULATION_EXPORT_BUCKET)
        .createSignedUrl(job.storage_path, POPULATION_EXPORT_URL_TTL_SECONDS, {
          download: exportFilename("bestand"),
        });
      const url = signed.data?.signedUrl;
      if (signed.error || !url) {
        throw new Error(signed.error?.message ?? "Kunne ikke lage nedlastingslenke.");
      }
      downloadUrl = url;
    }

    return NextResponse.json(
      {
        status: job.status,
        rowsFetched: job.rows_fetched,
        rowCount: job.row_count,
        truncated: job.truncated,
        error:
          job.status === "failed"
            ? (job.error_message ?? "Eksporten feilet. Prøv igjen.")
            : null,
        downloadUrl,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
