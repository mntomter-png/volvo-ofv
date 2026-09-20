import { createClient } from "@/lib/supabase/server";
import type { TmfRenewalPoolRow } from "@/lib/tmf/renewal";

type RenewalRpcRow = {
  pabygg: string;
  stock_count: number;
  old_count: number;
  overdue_count: number;
  due_90_count: number;
  focus_old_count: number;
};

type RpcClient = {
  rpc: (
    fn: "tmf_renewal_pool",
    args: {
      p_as_of?: string | null;
      p_focus_make?: string;
      p_old_years?: number;
    },
  ) => {
    returns: <T>() => Promise<{ data: T | null; error: { message: string } | null }>;
  };
};

function formatAsOf(reference: Date): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Henter fornyelsespulje per påbygg fra siste OFV-populasjonssnapshot. */
export async function getTmfRenewalPool(
  reference = new Date(),
  options?: { focusMake?: string; oldYears?: number },
): Promise<TmfRenewalPoolRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as RpcClient)
    .rpc("tmf_renewal_pool", {
      p_as_of: formatAsOf(reference),
      p_focus_make: options?.focusMake ?? "Volvo",
      p_old_years: options?.oldYears ?? 10,
    })
    .returns<RenewalRpcRow[]>();

  if (error) {
    // Tabellen/RPC kan mangle før migrasjonen er kjørt.
    if (error.message.includes("tmf_renewal_pool") || error.message.includes("PGRST202")) {
      console.warn("getTmfRenewalPool:", error.message);
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    pabygg: row.pabygg,
    stockCount: row.stock_count,
    oldCount: row.old_count,
    overdueCount: row.overdue_count,
    due90Count: row.due_90_count,
    focusOldCount: row.focus_old_count,
  }));
}

export interface TmfRenewalSnapshotCoverage {
  months: string[];
  latestMonth: string | null;
  rowCount: number;
  /** Antall hele måneder lagret (klart til kalibrering når ≥12). */
  monthCount: number;
}

/**
 * Hvilke månedlige fornyelsesaggregater vi har samlet.
 * Live-signalet bruker fortsatt bare dagens populasjon; historikken er for
 * fremtidig kalibrering/backtest når vi har ~12 måneder.
 */
export async function getTmfRenewalSnapshotCoverage(): Promise<TmfRenewalSnapshotCoverage> {
  const supabase = await createClient();

  const [monthsRes, countRes] = await Promise.all([
    supabase
      .from("tmf_renewal_snapshots")
      .select("snapshot_month")
      .order("snapshot_month", { ascending: true }),
    supabase
      .from("tmf_renewal_snapshots")
      .select("id", { count: "exact", head: true }),
  ]);

  if (monthsRes.error) {
    // Tabell kan mangle før migrasjonen er kjørt.
    return { months: [], latestMonth: null, rowCount: 0, monthCount: 0 };
  }

  const rows = (monthsRes.data ?? []) as { snapshot_month: string }[];
  const months = [
    ...new Set(rows.map((row) => String(row.snapshot_month).slice(0, 10))),
  ].sort();

  return {
    months,
    latestMonth: months.at(-1) ?? null,
    rowCount: countRes.count ?? 0,
    monthCount: months.length,
  };
}
