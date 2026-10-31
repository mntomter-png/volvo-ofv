import { normalizeTmfBudgetConfig, type TmfBudgetConfig } from "@/lib/tmf/adjustments";
import {
  normalizeTmfBudgetSnapshot,
  type TmfBudgetSnapshot,
} from "@/lib/tmf/budget-snapshot";
import { createClient } from "@/lib/supabase/server";

export interface TmfBudgetVersionRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_year: number;
  config: TmfBudgetConfig;
  /** Fryste tall fra lagringstidspunktet. Null for versjoner lagret før dette. */
  snapshot: TmfBudgetSnapshot | null;
  /** Navn eller e-post til den som lagret versjonen. Null hvis den ikke kunne slås opp. */
  creator_label: string | null;
  created_at: string;
  updated_at: string;
}

type BudgetRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_year: number;
  config: unknown;
  snapshot: unknown;
  creator_label: string | null;
  created_at: string;
  updated_at: string;
};

export async function getTmfBudgetVersions(): Promise<TmfBudgetVersionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tmf_budget_versions")
    .select(
      "id, user_id, name, description, target_year, config, snapshot, creator_label, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as BudgetRow[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    target_year: row.target_year,
    config: normalizeTmfBudgetConfig(row.config),
    snapshot: normalizeTmfBudgetSnapshot(row.snapshot),
    creator_label: row.creator_label,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
