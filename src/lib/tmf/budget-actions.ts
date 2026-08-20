"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeTmfBudgetConfig, type TmfBudgetConfig } from "@/lib/tmf/adjustments";
import { assertPageAccess } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

export type TmfBudgetActionState = {
  error?: string;
  success?: boolean;
  id?: string;
};

async function requireTmfUser() {
  const user = await assertPageAccess("tmf");
  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
  return { supabase, user };
}

function accessError(error: unknown): TmfBudgetActionState {
  return {
    error: error instanceof Error ? error.message : "Ingen tilgang.",
  };
}

function revalidateTmf() {
  revalidatePath("/tmf");
}

export async function createTmfBudgetVersion(input: {
  name: string;
  description?: string | null;
  targetYear: number;
  config: TmfBudgetConfig;
}): Promise<TmfBudgetActionState> {
  const name = input.name.trim();
  if (!name) return { error: "Navn er påkrevd." };

  let supabase;
  let user;
  try {
    ({ supabase, user } = await requireTmfUser());
  } catch (error) {
    return accessError(error);
  }

  const config = normalizeTmfBudgetConfig(input.config);

  const { data, error } = await supabase
    .from("tmf_budget_versions")
    .insert({
      user_id: user.id,
      name,
      description: input.description?.trim() || null,
      target_year: input.targetYear,
      config: config as unknown as Json,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("createTmfBudgetVersion:", error.message);
    return { error: "Kunne ikke lagre budsjettversjonen." };
  }

  revalidateTmf();
  return { success: true, id: data.id };
}

export async function updateTmfBudgetVersion(input: {
  id: string;
  name: string;
  description?: string | null;
}): Promise<TmfBudgetActionState> {
  const name = input.name.trim();
  if (!name) return { error: "Navn er påkrevd." };

  let supabase;
  try {
    ({ supabase } = await requireTmfUser());
  } catch (error) {
    return accessError(error);
  }

  const { error } = await supabase
    .from("tmf_budget_versions")
    .update({
      name,
      description: input.description?.trim() || null,
    })
    .eq("id", input.id);

  if (error) {
    console.error("updateTmfBudgetVersion:", error.message);
    return { error: "Kunne ikke oppdatere budsjettversjonen." };
  }

  revalidateTmf();
  return { success: true };
}

export async function deleteTmfBudgetVersion(id: string): Promise<TmfBudgetActionState> {
  let supabase;
  try {
    ({ supabase } = await requireTmfUser());
  } catch (error) {
    return accessError(error);
  }

  const { error } = await supabase.from("tmf_budget_versions").delete().eq("id", id);

  if (error) {
    console.error("deleteTmfBudgetVersion:", error.message);
    return { error: "Kunne ikke slette budsjettversjonen." };
  }

  revalidateTmf();
  return { success: true };
}
