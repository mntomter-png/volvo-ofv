"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { MFA_REQUIRED_MESSAGE } from "@/lib/auth/mfa";
import { assertFleetManager } from "@/lib/auth/roles";
import { parseDealerCodes } from "@/lib/fleet";
import { parseFleetVinUpload } from "@/lib/fleet/parse-vin-upload";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

export interface UploadFleetVinsResult {
  vinCount: number;
  chassisCount: number;
  matchedCount: number;
  unregisteredCount: number;
  skippedInvalid: number;
  skippedDealer: number;
  dealerFilterApplied: boolean;
  source: string;
  error?: string;
}

const EMPTY_RESULT: UploadFleetVinsResult = {
  vinCount: 0,
  chassisCount: 0,
  matchedCount: 0,
  unregisteredCount: 0,
  skippedInvalid: 0,
  skippedDealer: 0,
  dealerFilterApplied: false,
  source: "",
};

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function uploadFleetVins(
  formData: FormData,
): Promise<UploadFleetVinsResult> {
  try {
    await assertFleetManager();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ...EMPTY_RESULT, error: "Velg en fil å laste opp." };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { ...EMPTY_RESULT, error: "Filen er for stor (maks 10 MB)." };
    }

    const dealerField = formData.get("dealers");
    const dealerCodes = parseDealerCodes(
      typeof dealerField === "string" ? dealerField : "896, 890",
    );
    const parsed = parseFleetVinUpload(await file.arrayBuffer(), {
      dealerCodes,
    });
    if (parsed.vins.length === 0 && parsed.chassis.length === 0) {
      const filtered =
        parsed.skippedDealer > 0
          ? "Ingen rader igjen etter forhandlerfilteret."
          : "Ingen gyldige chassisnummer eller VIN-er funnet i filen.";
      return {
        ...EMPTY_RESULT,
        skippedInvalid: parsed.skippedInvalid,
        skippedDealer: parsed.skippedDealer,
        dealerFilterApplied: parsed.dealerFilterApplied,
        source: parsed.source,
        error: filtered,
      };
    }

    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const { data, error } = await rpcClient.rpc("replace_fleet_register", {
      p_vins: parsed.vins,
      p_chassis: parsed.chassis,
      p_source_label: file.name,
    });

    if (error) {
      console.error("[fleet] replace_fleet_register:", error.message);
      return {
        ...EMPTY_RESULT,
        skippedInvalid: parsed.skippedInvalid,
        skippedDealer: parsed.skippedDealer,
        dealerFilterApplied: parsed.dealerFilterApplied,
        source: parsed.source,
        error: "Kunne ikke oppdatere fleet-registeret.",
      };
    }

    const payload = data as Json | null;
    const record: Record<string, Json | undefined> =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : {};
    revalidatePath("/nyregistreringer");

    return {
      vinCount: asCount(record.vin_count),
      chassisCount: asCount(record.chassis_count),
      matchedCount: asCount(record.matched_count),
      unregisteredCount: asCount(record.unregistered_count),
      skippedInvalid: parsed.skippedInvalid,
      skippedDealer: parsed.skippedDealer,
      dealerFilterApplied: parsed.dealerFilterApplied,
      source: parsed.source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Opplasting feilet.";
    const safe =
      message === MFA_REQUIRED_MESSAGE ||
      message.startsWith("Du har ikke tilgang") ||
      message.startsWith("Fant ingen gyldige") ||
      message.startsWith("Ingen rader igjen") ||
      message.startsWith("Filen inneholder") ||
      message.startsWith("Kunne ikke lese")
        ? message
        : "Opplasting feilet.";
    return { ...EMPTY_RESULT, error: safe };
  }
}
