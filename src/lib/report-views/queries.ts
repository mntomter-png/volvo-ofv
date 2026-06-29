import { createClient } from "@/lib/supabase/server";
import type { PageType } from "@/lib/supabase/types";

export interface ReportViewRow {
  id: string;
  name: string;
  description: string | null;
  page_type: PageType;
  config: import("@/lib/supabase/types").ReportViewConfig;
  created_at: string;
  updated_at: string;
}

export async function getReportViews(
  pageType?: PageType,
): Promise<ReportViewRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("user_report_views")
    .select("id, name, description, page_type, config, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (pageType) {
    query = query.eq("page_type", pageType);
  }

  const { data, error } = await query.returns<ReportViewRow[]>();

  if (error) {
    console.error("getReportViews:", error.message);
    return [];
  }

  return data ?? [];
}

export async function getReportView(id: string): Promise<ReportViewRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_report_views")
    .select("id, name, description, page_type, config, created_at, updated_at")
    .eq("id", id)
    .maybeSingle<ReportViewRow>();

  if (error) {
    console.error("getReportView:", error.message);
    return null;
  }

  return data;
}
