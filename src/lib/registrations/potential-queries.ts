import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { effectiveRegistrationDates } from "@/lib/registrations/period";

/** Volvo-andel-terskel for «sterke» AdditionalBodyworks. */
export const POTENTIAL_MIN_FOCUS_SHARE = 0.3;
export const POTENTIAL_MIN_VOLUME = 20;
export const POTENTIAL_LIST_LIMIT = 200;

export type PotentialStatus =
  | "untapped"
  | "competitor"
  | "mixed"
  | "due"
  | "overdue";

export interface PotentialBodyworkProfile {
  bodyworkCode: number;
  bodyworkName: string;
  total: number;
  focusCount: number;
  focusShare: number;
  emobCount: number;
  emobShare: number;
  fitHpBucket: number | null;
  fitHpFocusShare: number;
  fitHpTotal: number;
}

export interface PotentialAccountRow {
  partyKey: string;
  partyName: string;
  region: number | null;
  district: string | null;
  status: PotentialStatus;
  potentialScore: number;
  fitScore: number;
  timingScore: number;
  sizeScore: number;
  focus10y: number;
  fleetFocus: number;
  fleetTotal: number;
  currentFocus: number;
  currentTotal: number;
  competitorUnits: number;
  lastFocusDate: string | null;
  yearsSinceLast: number | null;
  recommendedBodywork: number | null;
  recommendedBodyworkName: string | null;
  recommendedHpBucket: number | null;
  recommendedDriveline: string | null;
  bodyworkFocusShare: number;
  partyEmobShare: number;
  strongBodyworkUnits: number;
}

export interface PotentialTabData {
  profile: PotentialBodyworkProfile[];
  rows: PotentialAccountRow[];
  currentPeriod: { from: string; to: string };
  lookbackStart: string;
  focusMake: string;
  minFocusShare: number;
  minVolume: number;
  error: string | null;
}

function potentialRpcArgs(
  filters: RegistrationsFilters,
  district: string | null,
  excludeFinance: boolean,
) {
  const { from, to } = effectiveRegistrationDates(filters);
  return {
    p_year: filters.year,
    p_from: from,
    p_to: to,
    p_segment: filters.segment,
    p_region: filters.region,
    p_district: district,
    p_hp: filters.hp,
    p_fuel: filters.fuel,
    p_pabygg: filters.pabygg,
    p_bodywork: filters.bodywork,
    p_disp: filters.disp,
    p_chassis: filters.chassis,
    p_exclude_finance: excludeFinance,
    p_customer_party: "user" as const,
    p_min_share: POTENTIAL_MIN_FOCUS_SHARE,
    p_min_volume: POTENTIAL_MIN_VOLUME,
  };
}

function parseStatus(value: string): PotentialStatus {
  if (
    value === "untapped" ||
    value === "competitor" ||
    value === "mixed" ||
    value === "due" ||
    value === "overdue"
  ) {
    return value;
  }
  return "competitor";
}

function shiftYears(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mapProfile(
  data: ReadonlyArray<{
    bodywork_code: number;
    bodywork_name: string;
    total: number;
    focus_count: number;
    focus_share: number;
    emob_count: number;
    emob_share: number;
    fit_hp_bucket: number | null;
    fit_hp_focus_share: number;
    fit_hp_total: number;
  }>,
): PotentialBodyworkProfile[] {
  return data.map((row) => ({
    bodyworkCode: row.bodywork_code,
    bodyworkName: row.bodywork_name,
    total: row.total,
    focusCount: row.focus_count,
    focusShare: Number(row.focus_share ?? 0),
    emobCount: row.emob_count,
    emobShare: Number(row.emob_share ?? 0),
    fitHpBucket: row.fit_hp_bucket,
    fitHpFocusShare: Number(row.fit_hp_focus_share ?? 0),
    fitHpTotal: row.fit_hp_total,
  }));
}

function mapRows(
  data: ReadonlyArray<{
    party_key: string;
    party_name: string;
    region: number | null;
    district: string | null;
    status: string;
    potential_score: number;
    fit_score: number;
    timing_score: number;
    size_score: number;
    focus_10y: number;
    fleet_focus: number;
    fleet_total: number;
    current_focus: number;
    current_total: number;
    competitor_units: number;
    last_focus_date: string | null;
    years_since_last: number | null;
    recommended_bodywork: number | null;
    recommended_bodywork_name: string | null;
    recommended_hp_bucket: number | null;
    recommended_driveline: string | null;
    bodywork_focus_share: number;
    party_emob_share: number;
    strong_bodywork_units: number;
  }>,
): PotentialAccountRow[] {
  return data.map((row) => ({
    partyKey: row.party_key,
    partyName: row.party_name,
    region: row.region,
    district: row.district,
    status: parseStatus(row.status),
    potentialScore: row.potential_score,
    fitScore: row.fit_score,
    timingScore: row.timing_score,
    sizeScore: row.size_score,
    focus10y: row.focus_10y,
    fleetFocus: row.fleet_focus,
    fleetTotal: row.fleet_total,
    currentFocus: row.current_focus,
    currentTotal: row.current_total,
    competitorUnits: row.competitor_units,
    lastFocusDate: row.last_focus_date,
    yearsSinceLast:
      row.years_since_last == null ? null : Number(row.years_since_last),
    recommendedBodywork: row.recommended_bodywork,
    recommendedBodyworkName: row.recommended_bodywork_name,
    recommendedHpBucket: row.recommended_hp_bucket,
    recommendedDriveline: row.recommended_driveline,
    bodyworkFocusShare: Number(row.bodywork_focus_share ?? 0),
    partyEmobShare: Number(row.party_emob_share ?? 0),
    strongBodyworkUnits: row.strong_bodywork_units,
  }));
}

/** Potensial: kontoer i Volvo-sterke bodyworks som er utrafet eller forfalt. */
export async function getPotentialTabData(
  filters: RegistrationsFilters,
  focusMake: string,
  excludeFinance = true,
  district: string | null = null,
): Promise<PotentialTabData> {
  const { from, to } = effectiveRegistrationDates(filters);
  const currentPeriod = {
    from: from ?? `${filters.year}-01-01`,
    to: to ?? `${filters.year}-12-31`,
  };
  const lookbackStart = shiftYears(currentPeriod.to, -10);

  const empty: PotentialTabData = {
    profile: [],
    rows: [],
    currentPeriod,
    lookbackStart,
    focusMake,
    minFocusShare: POTENTIAL_MIN_FOCUS_SHARE,
    minVolume: POTENTIAL_MIN_VOLUME,
    error: null,
  };

  try {
    const supabase = await createClient();
    const rpcClient = supabase as unknown as SupabaseClient<Database>;
    const args = potentialRpcArgs(filters, district, excludeFinance);

    const [profileRes, listRes] = await Promise.all([
      rpcClient.rpc(
        "reg_potential_profile",
        withFocusMake(
          {
            p_year: args.p_year,
            p_from: args.p_from,
            p_to: args.p_to,
            p_segment: args.p_segment,
            p_region: args.p_region,
            p_district: args.p_district,
            p_hp: args.p_hp,
            p_fuel: args.p_fuel,
            p_pabygg: args.p_pabygg,
            p_bodywork: args.p_bodywork,
            p_disp: args.p_disp,
            p_chassis: args.p_chassis,
            p_min_share: args.p_min_share,
            p_min_volume: args.p_min_volume,
          },
          focusMake,
        ),
      ),
      rpcClient.rpc(
        "reg_potential_list",
        withFocusMake(
          {
            ...args,
            p_limit: POTENTIAL_LIST_LIMIT,
          },
          focusMake,
        ),
      ),
    ]);

    if (profileRes.error || listRes.error) {
      return {
        ...empty,
        error:
          profileRes.error?.message ??
          listRes.error?.message ??
          "Ukjent feil",
      };
    }

    return {
      profile: mapProfile(profileRes.data ?? []),
      rows: mapRows(listRes.data ?? []),
      currentPeriod,
      lookbackStart,
      focusMake,
      minFocusShare: POTENTIAL_MIN_FOCUS_SHARE,
      minVolume: POTENTIAL_MIN_VOLUME,
      error: null,
    };
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : "Ukjent feil",
    };
  }
}
