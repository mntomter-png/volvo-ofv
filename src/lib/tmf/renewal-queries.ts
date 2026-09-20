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
