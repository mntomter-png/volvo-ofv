import {
  COMMERCIAL_KINDS,
  type TmfCommercialIndicator,
  type TmfCommercialKind,
} from "@/lib/tmf/commercial";
import { createClient } from "@/lib/supabase/server";

type IndicatorRow = {
  id: string;
  kind: string;
  period_year: number;
  months_covered: number;
  yoy_pct: number | string;
  note: string | null;
  updated_at: string;
};

function toIndicator(row: IndicatorRow): TmfCommercialIndicator | null {
  if (!(COMMERCIAL_KINDS as readonly string[]).includes(row.kind)) return null;
  const yoyPct = typeof row.yoy_pct === "number" ? row.yoy_pct : Number(row.yoy_pct);
  if (!Number.isFinite(yoyPct)) return null;
  return {
    id: row.id,
    kind: row.kind as TmfCommercialKind,
    periodYear: row.period_year,
    monthsCovered: row.months_covered,
    yoyPct,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

export async function getTmfCommercialIndicators(): Promise<TmfCommercialIndicator[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tmf_commercial_indicators")
    .select("id, kind, period_year, months_covered, yoy_pct, note, updated_at")
    .order("period_year", { ascending: false });

  if (error) {
    // Tabellen kan mangle hvis migrasjonen ikke er kjørt ennå.
    if (error.message.includes("tmf_commercial_indicators") || error.code === "42P01") {
      console.warn("getTmfCommercialIndicators:", error.message);
      return [];
    }
    throw new Error(error.message);
  }

  return ((data ?? []) as IndicatorRow[])
    .map(toIndicator)
    .filter((row): row is TmfCommercialIndicator => row != null);
}
