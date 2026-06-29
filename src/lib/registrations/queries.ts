import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { MakeShare, MonthlyRegistration } from "@/lib/dashboard/queries";
import { REGISTRATIONS_PAGE_SIZE } from "@/lib/registrations/constants";
import {
  HEAVY_TRUCK_MIN_KG,
  OFV_TRANSACTION_NEW_REGISTRATION,
  type RegistrationsFilters,
} from "@/lib/registrations/filters";

const MONTH_LABELS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "mai",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "des",
] as const;

function formatMonthLabel(isoDate: string): string {
  const month = Number.parseInt(isoDate.slice(5, 7), 10) - 1;
  const year = isoDate.slice(0, 4);
  return `${MONTH_LABELS[month] ?? isoDate} ${year}`;
}

export interface RegistrationRow {
  registration_number: string;
  transaction_time: string;
  make_name: string | null;
  model_name: string | null;
  usage_name: string | null;
  maximum_laden_mass_kg: number | null;
  primary_owner_name: string | null;
  primary_owner_postal_code: string | null;
  primary_owner_postal_district: string | null;
  primary_user_name: string | null;
  primary_user_postal_code: string | null;
  primary_user_postal_district: string | null;
}

export interface RegistrationsSummary {
  total: number;
  volvoCount: number;
  volvoShare: number;
}

export interface RegistrationsPageData {
  filters: RegistrationsFilters;
  summary: RegistrationsSummary;
  segments: string[];
  makes: string[];
  byMonth: MonthlyRegistration[];
  byMake: MakeShare[];
  rows: RegistrationRow[];
  totalRows: number;
  totalPages: number;
}

function yearBounds(year: number) {
  return {
    from: `${year}-01-01T00:00:00`,
    to: `${year + 1}-01-01T00:00:00`,
  };
}

interface FilterableQuery<Q> {
  eq: (column: string, value: string | number) => Q;
  gt: (column: string, value: string | number) => Q;
  gte: (column: string, value: string | number) => Q;
  lt: (column: string, value: string | number) => Q;
}

function applyRegistrationFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: RegistrationsFilters,
) {
  const { from, to } = yearBounds(filters.year);
  let q = query
    .eq("transaction_type_id", OFV_TRANSACTION_NEW_REGISTRATION)
    .gt("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG)
    .gte("transaction_time", from)
    .lt("transaction_time", to);

  if (filters.segment) {
    q = q.eq("usage_name", filters.segment);
  }
  if (filters.make) {
    q = q.eq("make_name", filters.make);
  }
  return q;
}

export async function getRegistrationsPageData(
  filters: RegistrationsFilters,
): Promise<RegistrationsPageData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;

  const countQuery = applyRegistrationFilters(
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    filters,
  );
  const volvoCountQuery = applyRegistrationFilters(
    supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("make_name", "Volvo"),
    filters,
  );

  const offset = (filters.page - 1) * REGISTRATIONS_PAGE_SIZE;
  const rowsQuery = applyRegistrationFilters(
    supabase
      .from("registrations")
      .select(
        "registration_number, transaction_time, make_name, model_name, usage_name, maximum_laden_mass_kg, primary_owner_name, primary_owner_postal_code, primary_owner_postal_district, primary_user_name, primary_user_postal_code, primary_user_postal_district",
      )
      .order("transaction_time", { ascending: false })
      .range(offset, offset + REGISTRATIONS_PAGE_SIZE - 1),
    filters,
  );

  const [countRes, volvoCountRes, rowsRes, monthlyRes, byMakeRes, segmentsRes] =
    await Promise.all([
      countQuery,
      volvoCountQuery,
      rowsQuery,
      rpcClient.rpc("reg_summary_by_month", {
        p_year: filters.year,
        p_segment: filters.segment,
        p_make: filters.make,
      }),
      rpcClient.rpc("reg_summary_by_make", {
        p_year: filters.year,
        p_segment: filters.segment,
        p_make: filters.make,
        p_month: filters.month,
      }),
      supabase
        .from("dashboard_registrations_by_segment")
        .select("segment")
        .returns<{ segment: string }[]>(),
    ]);

  const makesRes = await rpcClient.rpc("reg_summary_by_make", {
    p_year: filters.year,
    p_segment: filters.segment,
    p_make: null,
  });

  const totalRows = countRes.count ?? 0;
  const volvoCount = volvoCountRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / REGISTRATIONS_PAGE_SIZE));

  return {
    filters,
    summary: {
      total: totalRows,
      volvoCount,
      volvoShare: totalRows > 0 ? (volvoCount / totalRows) * 100 : 0,
    },
    segments: (segmentsRes.data ?? []).map((row) => row.segment),
    makes: (makesRes.data ?? []).map((row) => row.make_name),
    byMonth: (monthlyRes.data ?? []).map((row) => ({
      month: row.month,
      count: row.count,
      label: formatMonthLabel(row.month),
    })),
    byMake: (byMakeRes.data ?? []).slice(0, 10),
    rows: rowsRes.data ?? [],
    totalRows,
    totalPages,
  };
}

const EXPORT_BATCH_SIZE = 1000;
const EXPORT_MAX_ROWS = 50000;

const REGISTRATION_EXPORT_COLUMNS =
  "registration_number, transaction_time, make_name, model_name, usage_name, maximum_laden_mass_kg, primary_owner_name, primary_owner_postal_code, primary_owner_postal_district, primary_user_name, primary_user_postal_code, primary_user_postal_district";

export async function getAllRegistrationsForExport(
  filters: RegistrationsFilters,
): Promise<RegistrationRow[]> {
  const supabase = await createClient();
  const all: RegistrationRow[] = [];

  for (let offset = 0; offset < EXPORT_MAX_ROWS; offset += EXPORT_BATCH_SIZE) {
    const batchQuery = applyRegistrationFilters(
      supabase
        .from("registrations")
        .select(REGISTRATION_EXPORT_COLUMNS)
        .order("transaction_time", { ascending: false })
        .range(offset, offset + EXPORT_BATCH_SIZE - 1),
      filters,
    );

    const { data } = await batchQuery;
    const batch = (data ?? []) as unknown as RegistrationRow[];
    all.push(...batch);

    if (batch.length < EXPORT_BATCH_SIZE) break;
  }

  return all;
}
