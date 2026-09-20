/**
 * Lagrer månedlig fornyelsesaggregat etter populasjonssynk.
 * Feiler soft — snapshot er for fremtidig kalibrering, ikke for live prognose.
 */
import { createAdminClient } from "@/lib/supabase/admin-core";

function monthFirstDay(isoDate: string): string {
  // publishDate kommer som YYYY-MM-DD fra OFV.
  return `${isoDate.slice(0, 7)}-01`;
}

export async function captureTmfRenewalSnapshot(options?: {
  /** OFV-populasjonsdato (YYYY-MM-DD). Styrer både as-of og snapshot-måned. */
  populationDate?: string;
  focusMake?: string;
  oldYears?: number;
}): Promise<number> {
  const supabase = createAdminClient();
  const populationDate = options?.populationDate;
  const snapshotMonth = populationDate
    ? monthFirstDay(populationDate)
    : undefined;

  const { data, error } = await supabase.rpc("tmf_capture_renewal_snapshot", {
    p_snapshot_month: snapshotMonth ?? null,
    p_as_of: populationDate ?? null,
    p_focus_make: options?.focusMake ?? "Volvo",
    p_old_years: options?.oldYears ?? 10,
  });

  if (error) {
    console.error("Kunne ikke lagre fornyelses-øyeblikksbilde:", error.message);
    return 0;
  }

  return typeof data === "number" ? data : Number(data) || 0;
}
