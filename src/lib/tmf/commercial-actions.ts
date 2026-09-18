"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertPageAccess } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { type TmfCommercialKind } from "@/lib/tmf/commercial";

export type TmfCommercialActionState = {
  error?: string;
  success?: boolean;
};

async function requireTmfUser() {
  const user = await assertPageAccess("tmf");
  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
  return { supabase, user };
}

function accessError(error: unknown): TmfCommercialActionState {
  return {
    error: error instanceof Error ? error.message : "Ingen tilgang.",
  };
}

function parsePct(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(value)) return null;
  return Math.max(-100, Math.min(200, value));
}

function parseYear(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isInteger(value) || value < 2000 || value > 2100) return null;
  return value;
}

function parseMonths(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isInteger(value)) return 12;
  return Math.max(1, Math.min(12, value));
}

/**
 * Lagrer YoY-prosent for et år. Tomt felt sletter den indikatoren for året,
 * slik at vi ikke beholder et gammelt tall som ser ut som et aktivt signal.
 */
export async function upsertTmfCommercialYear(input: {
  periodYear: number;
  monthsCovered: number;
  orderIntakeYoyPct: number | string | null;
  quoteActivityYoyPct: number | string | null;
  note?: string | null;
}): Promise<TmfCommercialActionState> {
  const periodYear = parseYear(input.periodYear);
  if (periodYear == null) return { error: "Ugyldig år." };

  let supabase;
  let user;
  try {
    ({ supabase, user } = await requireTmfUser());
  } catch (error) {
    return accessError(error);
  }

  const monthsCovered = parseMonths(input.monthsCovered);
  const note = input.note?.trim() || null;
  const values: { kind: TmfCommercialKind; yoyPct: number | null }[] = [
    { kind: "order_intake", yoyPct: parsePct(input.orderIntakeYoyPct) },
    { kind: "quote_activity", yoyPct: parsePct(input.quoteActivityYoyPct) },
  ];

  for (const item of values) {
    if (item.yoyPct == null) {
      const { error } = await supabase
        .from("tmf_commercial_indicators")
        .delete()
        .eq("kind", item.kind)
        .eq("period_year", periodYear);
      if (error) {
        console.error("upsertTmfCommercialYear delete:", error.message);
        return { error: "Kunne ikke oppdatere indikatoren." };
      }
      continue;
    }

    const { error } = await supabase.from("tmf_commercial_indicators").upsert(
      {
        kind: item.kind,
        period_year: periodYear,
        months_covered: monthsCovered,
        yoy_pct: item.yoyPct,
        note,
        created_by: user.id,
      },
      { onConflict: "kind,period_year" },
    );
    if (error) {
      console.error("upsertTmfCommercialYear upsert:", error.message);
      if (error.message.includes("tmf_commercial_indicators")) {
        return { error: "Tabellen for indikatorer er ikke opprettet ennå. Kjør migrasjonen først." };
      }
      return { error: "Kunne ikke lagre prosenttallet." };
    }
  }

  revalidatePath("/tmf");
  return { success: true };
}

export async function deleteTmfCommercialYear(
  periodYear: number,
): Promise<TmfCommercialActionState> {
  const year = parseYear(periodYear);
  if (year == null) return { error: "Ugyldig år." };

  let supabase;
  try {
    ({ supabase } = await requireTmfUser());
  } catch (error) {
    return accessError(error);
  }

  const { error } = await supabase
    .from("tmf_commercial_indicators")
    .delete()
    .eq("period_year", year);
  if (error) {
    console.error("deleteTmfCommercialYear:", error.message);
    return { error: "Kunne ikke slette året." };
  }

  revalidatePath("/tmf");
  return { success: true };
}
