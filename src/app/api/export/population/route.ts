import { NextResponse } from "next/server";

import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import {
  apiErrorResponse,
  requireApiPageAccess,
} from "@/lib/auth/api-access";
import { excelResponse, exportFilename } from "@/lib/export/excel";
import { SYNC_XLSX_SAFE_BYTES } from "@/lib/export/xlsx-bytes";
import { dispatchPopulationExport, dispatchPopulationFullExport } from "@/lib/population/export-dispatch";
import {
  FILTERED_DIRECT_MAX_ROWS,
  fullExportAction,
  fullPopulationExportPath,
  isUnfilteredPopulationExport,
  filteredExportUsesDirectResponse,
} from "@/lib/population/export-shared";
import {
  buildFilteredPopulationWorkbook,
  insertQueuedPopulationExportJob,
  markPopulationExportJobFailed,
  publishFilteredPopulationExport,
  readFullPopulationExport,
  readLatestPopulationSnapshot,
  signPopulationExportPath,
} from "@/lib/population/export-supabase";
import { parsePopulationSearchParams } from "@/lib/population/filters";
import { applyPopulationFilters } from "@/lib/population/queries";
import { createAdminClient } from "@/lib/supabase/admin-core";

export const runtime = "nodejs";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Uten filtre: signer den forhåndsbygde filen, eller start bygging.
 * Med filtre: lever filen direkte når den er under 5 MB, ellers bakgrunnsjobb.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiPageAccess("populasjon");
    const limited = await assertExportRateLimit({
      request,
      userId: user.id,
      route: "population",
    });
    if (limited) return limited;

    const filters = parsePopulationSearchParams(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const admin = createAdminClient();
    const snapshotDate = await readLatestPopulationSnapshot(admin);
    if (!snapshotDate) {
      return json({ error: "Ingen bestand å eksportere." }, 409);
    }

    if (isUnfilteredPopulationExport(filters)) {
      const stored = await readFullPopulationExport(snapshotDate, admin);
      const action = fullExportAction(
        stored
          ? {
              status: stored.status,
              updatedAt: stored.updatedAt,
              storagePath: stored.storagePath,
            }
          : null,
        Date.now(),
      );

      if (action === "sign" && stored?.storagePath) {
        const expected = fullPopulationExportPath(snapshotDate);
        if (stored.storagePath === expected) {
          try {
            const downloadUrl = await signPopulationExportPath(
              stored.storagePath,
              admin,
            );
            return json({ mode: "ready", downloadUrl });
          } catch (signError) {
            console.error(
              "[population-export] sign",
              signError instanceof Error ? signError.message : signError,
            );
          }
        }
        await dispatchPopulationFullExport({ force: true, wait: false });
        return json({
          mode: "preparing",
          pollUrl: "/api/export/population/status?full=1",
        });
      }

      if (action === "start") {
        await dispatchPopulationFullExport({ force: false, wait: false });
      }
      return json({
        mode: "preparing",
        pollUrl: "/api/export/population/status?full=1",
      });
    }

    const counted = await applyPopulationFilters(
      admin.from("population").select("*", { count: "exact", head: true }),
      filters,
      snapshotDate,
    );
    const rowCount = counted.error ? null : counted.count;

    if (!filteredExportUsesDirectResponse(rowCount)) {
      const jobId = await insertQueuedPopulationExportJob(admin, {
        userId: user.id,
        filters,
        snapshotDate,
      });
      try {
        await dispatchPopulationExport(jobId);
      } catch (dispatchError) {
        await markPopulationExportJobFailed(
          admin,
          jobId,
          "Eksporten kunne ikke startes.",
        );
        throw dispatchError;
      }
      return json({
        mode: "job",
        jobId,
        pollUrl: `/api/export/population/status?id=${encodeURIComponent(jobId)}`,
      });
    }

    const built = await buildFilteredPopulationWorkbook(admin, {
      filters,
      snapshotDate,
      maxRows: rowCount ?? FILTERED_DIRECT_MAX_ROWS,
    });
    if (built.bytes.byteLength > SYNC_XLSX_SAFE_BYTES) {
      const downloadUrl = await publishFilteredPopulationExport(admin, {
        userId: user.id,
        filters,
        snapshotDate,
        bytes: built.bytes,
        rowCount: built.rowCount,
        truncated: built.truncated,
      });
      return json({ mode: "ready", downloadUrl });
    }

    return excelResponse(Buffer.from(built.bytes), exportFilename("bestand"));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
