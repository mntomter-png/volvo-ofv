import { NextResponse } from "next/server";

import { assertExportRateLimit } from "@/lib/auth/export-rate-limit";
import {
  apiErrorResponse,
  requireApiPageAccess,
} from "@/lib/auth/api-access";
import { dispatchPopulationExport } from "@/lib/population/export-dispatch";
import { populationFiltersToStored } from "@/lib/population/export-shared";
import { parsePopulationSearchParams } from "@/lib/population/filters";
import { createAdminClient } from "@/lib/supabase/admin-core";
import type { Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

const STALE_JOB_MS = 20 * 60 * 1000;

/**
 * Starter en bakgrunnsjobb. Selve filen returneres ikke her: en komplett
 * bestand-.xlsx er større enn Netlify sin synkrone grense på 6 MB.
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

    const snapshotRes = await admin
      .from("population")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshotRes.error) throw new Error(snapshotRes.error.message);
    const snapshotDate = snapshotRes.data?.snapshot_date ?? null;
    if (!snapshotDate) {
      return NextResponse.json(
        { error: "Ingen bestand å eksportere." },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();
    const staleBefore = new Date(Date.now() - STALE_JOB_MS).toISOString();
    await admin
      .from("population_export_jobs")
      .update({
        status: "failed",
        error_message: "Eksporten ble avbrutt.",
        updated_at: nowIso,
      })
      .eq("user_id", user.id)
      .in("status", ["queued", "running"])
      .lt("updated_at", staleBefore);

    const { data: job, error } = await admin
      .from("population_export_jobs")
      .insert({
        user_id: user.id,
        status: "queued",
        filters: populationFiltersToStored(filters) as Json,
        snapshot_date: snapshotDate,
      })
      .select("id")
      .single();
    if (error || !job) {
      throw new Error(error?.message ?? "Kunne ikke opprette eksport.");
    }

    try {
      await dispatchPopulationExport(job.id);
    } catch (dispatchError) {
      await admin
        .from("population_export_jobs")
        .update({
          status: "failed",
          error_message: "Eksporten kunne ikke startes.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      throw dispatchError;
    }

    return NextResponse.json(
      { jobId: job.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
