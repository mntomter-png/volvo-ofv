import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { effectiveRegistrationDates } from "@/lib/registrations/period";

export type OwnerDeclineStatus =
  | "competitor"
  | "mixed"
  | "due"
  | "overdue"
  | "ok";

export type KontoerKpiBucket =
  | "priority"
  | "customers"
  | "competitor"
  | "due"
  | "overdue";

export interface OwnerFocusDeclineRow {
  ownerKey: string;
  ownerName: string;
  region: number | null;
  focus10y: number;
  currentFocus: number;
  currentTotal: number;
  competitorUnits: number;
  lastFocusDate: string | null;
  yearsSinceLast: number;
  status: OwnerDeclineStatus;
  priorityScore: number;
  sizeScore: number;
  signalScore: number;
  recencyScore: number;
}

export interface OwnerFocusDeclineSummary {
  customers10y: number;
  competitorOnlyOwners: number;
  mixedOwners: number;
  dueOwners: number;
  overdueOwners: number;
}

export interface KontoerTabData {
  summary: OwnerFocusDeclineSummary;
  rows: OwnerFocusDeclineRow[];
  currentPeriod: { from: string; to: string };
  lookbackStart: string;
  focusMake: string;
  error: string | null;
}

function declineRpcArgs(filters: RegistrationsFilters, excludeFinance: boolean) {
  const { from, to } = effectiveRegistrationDates(filters);
  return {
    p_year: filters.year,
    p_from: from,
    p_to: to,
    p_segment: filters.segment,
    p_region: filters.region,
    p_hp: filters.hp,
    p_fuel: filters.fuel,
    p_pabygg: filters.pabygg,
    p_bodywork: filters.bodywork,
    p_disp: filters.disp,
    p_chassis: filters.chassis,
    p_exclude_finance: excludeFinance,
  };
}

function parseStatus(value: string): OwnerDeclineStatus {
  if (
    value === "competitor" ||
    value === "mixed" ||
    value === "due" ||
    value === "overdue" ||
    value === "ok"
  ) {
    return value;
  }
  return "ok";
}

function mapListRows(
  data: ReadonlyArray<{
    owner_key: string;
    owner_name: string;
    region: number | null;
    focus_10y: number;
    current_focus: number;
    current_total: number;
    competitor_units: number;
    last_focus_date: string | null;
    years_since_last: number;
    status: string;
    priority_score: number;
    size_score: number;
    signal_score: number;
    recency_score: number;
  }>,
): OwnerFocusDeclineRow[] {
  return data.map((row) => ({
    ownerKey: row.owner_key,
    ownerName: row.owner_name,
    region: row.region,
    focus10y: row.focus_10y,
    currentFocus: row.current_focus,
    currentTotal: row.current_total,
    competitorUnits: row.competitor_units,
    lastFocusDate: row.last_focus_date,
    yearsSinceLast: Number(row.years_since_last ?? 0),
    status: parseStatus(row.status),
    priorityScore: row.priority_score,
    sizeScore: row.size_score,
    signalScore: row.signal_score,
    recencyScore: row.recency_score,
  }));
}

export function kontoerBucketLimit(bucket: KontoerKpiBucket): number {
  return bucket === "customers" ? 150 : 100;
}

function shiftYears(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Kundeutvikling: 10-års kundebase, forfall 3–5 / forfalt 5+, konkurrent vs blandet. */
export async function getKontoerTabData(
  filters: RegistrationsFilters,
  focusMake: string,
  excludeFinance = true,
): Promise<KontoerTabData> {
  const { from, to } = effectiveRegistrationDates(filters);
  const currentPeriod = {
    from: from ?? `${filters.year}-01-01`,
    to: to ?? `${filters.year}-12-31`,
  };
  const lookbackStart = shiftYears(currentPeriod.to, -10);

  const empty: KontoerTabData = {
    summary: {
      customers10y: 0,
      competitorOnlyOwners: 0,
      mixedOwners: 0,
      dueOwners: 0,
      overdueOwners: 0,
    },
    rows: [],
    currentPeriod,
    lookbackStart,
    focusMake,
    error: null,
  };

  try {
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const args = declineRpcArgs(filters, excludeFinance);

    const [summaryRes, listRes] = await Promise.all([
      rpcClient.rpc(
        "reg_owner_focus_decline_summary",
        withFocusMake(args, focusMake),
      ),
      rpcClient.rpc(
        "reg_owner_focus_decline_list",
        withFocusMake(
          { ...args, p_limit: 25, p_bucket: "priority" },
          focusMake,
        ),
      ),
    ]);

    if (summaryRes.error || listRes.error) {
      return {
        ...empty,
        error:
          summaryRes.error?.message ??
          listRes.error?.message ??
          "Ukjent feil",
      };
    }

    const summaryRow = summaryRes.data?.[0];

    return {
      summary: {
        customers10y: summaryRow?.customers_10y ?? 0,
        competitorOnlyOwners: summaryRow?.competitor_only_owners ?? 0,
        mixedOwners: summaryRow?.mixed_owners ?? 0,
        dueOwners: summaryRow?.due_owners ?? 0,
        overdueOwners: summaryRow?.overdue_owners ?? 0,
      },
      rows: mapListRows(listRes.data ?? []),
      currentPeriod,
      lookbackStart,
      focusMake,
      error: null,
    };
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : "Ukjent feil",
    };
  }
}
