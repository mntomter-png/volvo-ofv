"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database, PageType, ReportViewConfig } from "@/lib/supabase/types";

export type ReportViewActionState = {
  error?: string;
  success?: boolean;
};

async function requireUser() {
  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null as null };
  }

  return { supabase, user };
}

function revalidateReportViews() {
  revalidatePath("/rapportvisninger");
  revalidatePath("/");
}

export async function createReportView(input: {
  name: string;
  description?: string | null;
  page_type: PageType;
  config: ReportViewConfig;
}): Promise<ReportViewActionState & { id?: string }> {
  const name = input.name.trim();
  if (!name) {
    return { error: "Navn er påkrevd." };
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "Du må være innlogget." };
  }

  const { data, error } = await supabase
    .from("user_report_views")
    .insert({
      user_id: user.id,
      name,
      description: input.description?.trim() || null,
      page_type: input.page_type,
      config: input.config,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("createReportView:", error.message);
    return { error: "Kunne ikke lagre visningen. Prøv igjen." };
  }

  revalidateReportViews();
  return { success: true, id: data.id };
}

export async function updateReportView(input: {
  id: string;
  name: string;
  description?: string | null;
}): Promise<ReportViewActionState> {
  const name = input.name.trim();
  if (!name) {
    return { error: "Navn er påkrevd." };
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "Du må være innlogget." };
  }

  const { error } = await supabase
    .from("user_report_views")
    .update({
      name,
      description: input.description?.trim() || null,
    })
    .eq("id", input.id);

  if (error) {
    console.error("updateReportView:", error.message);
    return { error: "Kunne ikke oppdatere visningen." };
  }

  revalidateReportViews();
  return { success: true };
}

export async function deleteReportView(id: string): Promise<ReportViewActionState> {
  const { supabase, user } = await requireUser();
  if (!user) {
    return { error: "Du må være innlogget." };
  }

  const { error } = await supabase.from("user_report_views").delete().eq("id", id);

  if (error) {
    console.error("deleteReportView:", error.message);
    return { error: "Kunne ikke slette visningen." };
  }

  revalidateReportViews();
  return { success: true };
}
