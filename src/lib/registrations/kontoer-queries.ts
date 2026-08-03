import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { shiftIsoDateByYears } from "@/lib/kpi/yoy";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { effectiveRegistrationDates } from "@/lib/registrations/period";

export type OwnerDeclineStatus = "competitor" | "dormant" | "reduced";

export interface OwnerFocusDeclineRow {
  ownerKey: string;
  ownerName: string;
  region: number | null;
  currentFocus: number;
  priorFocus: number;
  delta: number;
  lastFocusDate: string | null;
  currentTotal: number;
  priorTotal: number;
  currentSharePct: number | null;
  priorSharePct: number | null;
  shareDeltaPp: number | null;
  competitorUnits: number;
  status: OwnerDeclineStatus;
  priorityScore: number;
  volumeScore: number;
  shareScore: number;
  recencyScore: number;
}

export interface OwnerFocusDeclineSummary {
  decliningOwners: number;
  lostUnits: number;
  priorFocusOwners: number;
  competitorSwitchOwners: number;
  dormantOwners: number;
}

export interface KontoerTabData {
  summary: OwnerFocusDeclineSummary;
  rows: OwnerFocusDeclineRow[];
  currentPeriod: { from: string; to: string };
  priorPeriod: { from: string; to: string };
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
  if (value === "competitor" || value === "dormant" || value === "reduced") {
    return value;
  }
  return "dormant";
}

/** Kundeutvikling: fallende volum med status + differensiert prioriteringsscore. */
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
  const priorPeriod = {
    from: shiftIsoDateByYears(currentPeriod.from, -1),
    to: shiftIsoDateByYears(currentPeriod.to, -1),
  };

  const empty: KontoerTabData = {
    summary: {
      decliningOwners: 0,
      lostUnits: 0,
      priorFocusOwners: 0,
      competitorSwitchOwners: 0,
      dormantOwners: 0,
    },
    rows: [],
    currentPeriod,
    priorPeriod,
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
        withFocusMake({ ...args, p_limit: 25 }, focusMake),
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
        decliningOwners: summaryRow?.declining_owners ?? 0,
        lostUnits: summaryRow?.lost_units ?? 0,
        priorFocusOwners: summaryRow?.prior_focus_owners ?? 0,
        competitorSwitchOwners: summaryRow?.competitor_switch_owners ?? 0,
        dormantOwners: summaryRow?.dormant_owners ?? 0,
      },
      rows: (listRes.data ?? []).map((row) => ({
        ownerKey: row.owner_key,
        ownerName: row.owner_name,
        region: row.region,
        currentFocus: row.current_focus,
        priorFocus: row.prior_focus,
        delta: row.delta,
        lastFocusDate: row.last_focus_date,
        currentTotal: row.current_total,
        priorTotal: row.prior_total,
        currentSharePct:
          row.current_share_pct == null
            ? null
            : Number(row.current_share_pct),
        priorSharePct:
          row.prior_share_pct == null ? null : Number(row.prior_share_pct),
        shareDeltaPp:
          row.share_delta_pp == null ? null : Number(row.share_delta_pp),
        competitorUnits: row.competitor_units,
        status: parseStatus(row.status),
        priorityScore: row.priority_score,
        volumeScore: row.volume_score,
        shareScore: row.share_score,
        recencyScore: row.recency_score,
      })),
      currentPeriod,
      priorPeriod,
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
