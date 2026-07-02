import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { PkkFilters, PkkHorizon } from "@/lib/pkk/filters";
import {
  getPkkPriority,
  PKK_PRIORITY_LABELS,
} from "@/lib/pkk/priority";
import { getRegionLabel } from "@/lib/ofv/segmentation";

export interface PkkSummary {
  customerCount: number;
  volvoVehicles: number;
  overdueCount: number;
  due30Count: number;
  due90Count: number;
  due180Count: number;
  noPkkDateCount: number;
}

export interface PkkCustomerRow {
  owner_key: string;
  owner_name: string;
  owner_orgnr: string | null;
  owner_location: string | null;
  sales_region: number | null;
  focus_count: number;
  overdue_count: number;
  due_30_count: number;
  due_90_count: number;
  due_180_count: number;
  next_deadline: string | null;
  days_to_next: number | null;
}

export interface PkkExportVehicleRow {
  owner_name: string;
  owner_orgnr: string | null;
  registration_number: string;
  model_name: string | null;
  pkk_last_date: string | null;
  pkk_next_deadline: string | null;
  days_until_due: number | null;
}

export interface PkkPageData {
  snapshotDate: string | null;
  summary: PkkSummary;
  customers: PkkCustomerRow[];
  hasPkkDates: boolean;
  error: string | null;
}

export interface PkkExportData {
  customers: PkkCustomerRow[];
  vehicles: PkkExportVehicleRow[];
}

const CUSTOMER_LIMIT = 50;
export const PKK_EXPORT_VEHICLE_LIMIT = 1000;

function emptySummary(): PkkSummary {
  return {
    customerCount: 0,
    volvoVehicles: 0,
    overdueCount: 0,
    due30Count: 0,
    due90Count: 0,
    due180Count: 0,
    noPkkDateCount: 0,
  };
}

function buildRpcArgs(filters: PkkFilters, focusMake: string, customerLimit: number) {
  return withFocusMake(
    {
      p_region: filters.region,
      p_min_volvo: filters.minFleet,
      p_customer_limit: customerLimit,
      p_only_follow_up: filters.onlyFollowUp,
      p_horizon: filters.horizon,
    },
    focusMake,
  );
}

function mapCustomerRow(row: {
  owner_key: string;
  owner_name: string;
  owner_orgnr: string | null;
  owner_location: string | null;
  sales_region: number | null;
  focus_count: number;
  overdue_count: number;
  due_30_count: number;
  due_90_count: number;
  due_180_count: number;
  next_deadline: string | null;
  days_to_next: number | null;
}): PkkCustomerRow {
  return {
    owner_key: row.owner_key,
    owner_name: row.owner_name,
    owner_orgnr: row.owner_orgnr,
    owner_location: row.owner_location,
    sales_region: row.sales_region,
    focus_count: row.focus_count,
    overdue_count: row.overdue_count,
    due_30_count: row.due_30_count,
    due_90_count: row.due_90_count,
    due_180_count: row.due_180_count,
    next_deadline: row.next_deadline,
    days_to_next: row.days_to_next,
  };
}

/** Henter PKK storkundeoppfølging: KPI-er og prioritert kundeliste. */
export async function getPkkPageData(
  filters: PkkFilters,
  focusMake: string,
): Promise<PkkPageData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;

  const { data: snapshotRow } = await supabase
    .from("population")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ snapshot_date: string }>();

  const snapshotDate = snapshotRow?.snapshot_date ?? null;
  if (!snapshotDate) {
    return {
      snapshotDate: null,
      summary: emptySummary(),
      customers: [],
      hasPkkDates: false,
      error: null,
    };
  }

  const rpcArgs = buildRpcArgs(filters, focusMake, CUSTOMER_LIMIT);

  const [summaryRes, customersRes, pkkCountRes] = await Promise.all([
    rpcClient.rpc("pop_pkk_summary", rpcArgs),
    rpcClient.rpc("pop_pkk_customers", rpcArgs),
    supabase
      .from("population")
      .select("*", { count: "exact", head: true })
      .eq("snapshot_date", snapshotDate)
      .not("pkk_next_deadline", "is", null),
  ]);

  const error =
    summaryRes.error?.message ?? customersRes.error?.message ?? null;

  const summaryRow = summaryRes.data?.[0];

  return {
    snapshotDate,
    summary: summaryRow
      ? {
          customerCount: summaryRow.customer_count,
          volvoVehicles: summaryRow.volvo_vehicles,
          overdueCount: summaryRow.overdue_count,
          due30Count: summaryRow.due_30_count,
          due90Count: summaryRow.due_90_count,
          due180Count: summaryRow.due_180_count,
          noPkkDateCount: summaryRow.no_pkk_date_count,
        }
      : emptySummary(),
    customers: (customersRes.data ?? []).map(mapCustomerRow),
    hasPkkDates: (pkkCountRes.count ?? 0) > 0,
    error,
  };
}

/** Henter kunder og kjøretøy for Excel-eksport. */
export async function getPkkExportData(
  filters: PkkFilters,
  focusMake: string,
): Promise<PkkExportData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;
  const rpcArgs = buildRpcArgs(filters, focusMake, CUSTOMER_LIMIT);

  const [customersRes, vehiclesRes] = await Promise.all([
    rpcClient.rpc("pop_pkk_customers", rpcArgs),
    rpcClient.rpc(
      "pop_pkk_due_soon_vehicles",
      withFocusMake(
        {
          p_segment: null,
          p_make: null,
          p_region: filters.region,
          p_hp: null,
          p_fuel: null,
          p_pabygg: null,
          p_disp: null,
          p_chassis: null,
          p_age: null,
          p_months: 6,
          p_min_volvo: filters.minFleet,
          p_owner_limit: CUSTOMER_LIMIT,
          p_vehicle_limit: PKK_EXPORT_VEHICLE_LIMIT,
        },
        focusMake,
      ),
    ),
  ]);

  if (customersRes.error) {
    throw new Error(customersRes.error.message);
  }
  if (vehiclesRes.error) {
    throw new Error(vehiclesRes.error.message);
  }

  const customers = (customersRes.data ?? []).map(mapCustomerRow);
  const ownerKeys = new Set(customers.map((c) => c.owner_key));
  const customerByKey = new Map(customers.map((c) => [c.owner_key, c]));

  const vehicles = (vehiclesRes.data ?? [])
    .filter((row) => ownerKeys.has(row.owner_key))
    .filter((row) =>
      vehicleInHorizon(row.days_until_due, filters.horizon),
    )
    .map((row) => ({
      owner_name: row.owner_name,
      owner_orgnr: customerByKey.get(row.owner_key)?.owner_orgnr ?? null,
      registration_number: row.registration_number,
      model_name: row.model_name,
      pkk_last_date: row.pkk_last_date,
      pkk_next_deadline: row.pkk_next_deadline,
      days_until_due: row.days_until_due,
    }));

  return { customers, vehicles };
}

export function vehicleInHorizon(
  daysUntilDue: number | null,
  horizon: PkkHorizon,
): boolean {
  if (daysUntilDue == null) return false;
  if (horizon === "all") return true;
  if (horizon === "upcoming") return daysUntilDue >= 0;
  return daysUntilDue >= -90;
}

export function formatPkkExportPriority(customer: PkkCustomerRow): string {
  return PKK_PRIORITY_LABELS[getPkkPriority(customer)];
}

export function formatPkkExportRegion(region: number | null): string {
  return region != null ? getRegionLabel(region) : "";
}
