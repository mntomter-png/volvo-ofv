import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { shiftIsoDateByYears } from "@/lib/kpi/yoy";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { effectiveRegistrationDates } from "@/lib/registrations/queries";

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
}

export interface OwnerFocusDeclineSummary {
  decliningOwners: number;
  lostUnits: number;
  priorFocusOwners: number;
}

export interface KontoerTabData {
  summary: OwnerFocusDeclineSummary;
  rows: OwnerFocusDeclineRow[];
  currentPeriod: { from: string; to: string };
  priorPeriod: { from: string; to: string };
  focusMake: string;
  error: string | null;
}

function declineRpcArgs(filters: RegistrationsFilters) {
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
  };
}

/** Fase 1: eiere med fallende fokusmerke-volum vs. samme vindu året før. */
export async function getKontoerTabData(
  filters: RegistrationsFilters,
  focusMake: string,
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
    summary: { decliningOwners: 0, lostUnits: 0, priorFocusOwners: 0 },
    rows: [],
    currentPeriod,
    priorPeriod,
    focusMake,
    error: null,
  };

  try {
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const args = declineRpcArgs(filters);

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
