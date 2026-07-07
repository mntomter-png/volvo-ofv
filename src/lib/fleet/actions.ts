"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { assertFleetManager } from "@/lib/auth/roles";
import { parseFleetVinUpload } from "@/lib/fleet/parse-vin-upload";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface UploadFleetVinsResult {
  vinCount: number;
  skippedInvalid: number;
  source: string;
  error?: string;
}

export async function uploadFleetVins(
  formData: FormData,
): Promise<UploadFleetVinsResult> {
  try {
    await assertFleetManager();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return {
        vinCount: 0,
        skippedInvalid: 0,
        source: "",
        error: "Velg en fil å laste opp.",
      };
    }

    if (file.size > 10 * 1024 * 1024) {
      return {
        vinCount: 0,
        skippedInvalid: 0,
        source: "",
        error: "Filen er for stor (maks 10 MB).",
      };
    }

    const parsed = parseFleetVinUpload(await file.arrayBuffer());
    if (parsed.vins.length === 0) {
      return {
        vinCount: 0,
        skippedInvalid: parsed.skippedInvalid,
        source: parsed.source,
        error: "Ingen gyldige VIN-er funnet i filen.",
      };
    }

    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const { data, error } = await rpcClient.rpc("replace_fleet_vins", {
      p_vins: parsed.vins,
      p_source_label: file.name,
    });

    if (error) {
      return {
        vinCount: 0,
        skippedInvalid: parsed.skippedInvalid,
        source: parsed.source,
        error: error.message,
      };
    }

    const payload = data as { vin_count?: number } | null;
    revalidatePath("/nyregistreringer");

    return {
      vinCount: payload?.vin_count ?? parsed.vins.length,
      skippedInvalid: parsed.skippedInvalid,
      source: parsed.source,
    };
  } catch (err) {
    return {
      vinCount: 0,
      skippedInvalid: 0,
      source: "",
      error: err instanceof Error ? err.message : "Opplasting feilet.",
    };
  }
}
