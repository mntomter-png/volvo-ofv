import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type {
  MakeShare,
  MonthlyRegistration,
  SegmentShare,
} from "@/lib/dashboard/queries";
import {
  BODYWORK_FILTER_OPTIONS,
  BODYWORK_NULL_CODE,
  CHASSIS_FILTER_OPTIONS,
  DISP_BUCKET_FILTER_OPTIONS,
  getBodyworkFilterLabel,
  getDispBucketLabel,
  getHpBucketLabel,
  getPabyggSegmentLabel,
  getRegionLabel,
  HP_BUCKET_FILTER_OPTIONS,
  PABYGG_FILTER_OPTIONS,
  REGION_FILTER_OPTIONS,
} from "@/lib/ofv/segmentation";
import {
  buildElectricSegmentTrend,
  buildStackedMakeRows,
  type ElectricSegmentTrendSeries,
  type StackedMakeRow,
} from "@/lib/registrations/analytics";
import { REGISTRATIONS_PAGE_SIZE } from "@/lib/registrations/constants";
import type { RegistrationsTabId } from "@/lib/registrations/tabs";
import {
  HEAVY_TRUCK_MIN_KG,
  OFV_TRANSACTION_NEW_REGISTRATION,
  type RegistrationsFilters,
} from "@/lib/registrations/filters";
import {
  comparisonPeriodLabel,
  previousPeriodFilters,
  resolveRegistrationPeriod,
  type KpiYoYComparison,
} from "@/lib/kpi/yoy";

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
  variant_name: string | null;
  usage_name: string | null;
  maximum_laden_mass_kg: number | null;
  sales_region: number | null;
  hp_bucket: number | null;
  fuel_name: string | null;
  pabygg_segment: string | null;
  bodywork_code: number | null;
  bodywork_name: string | null;
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
  electricCount: number;
  electricShare: number;
  /** Sammenligning med tilsvarende periode året før (null hvis ikke tilgjengelig). */
  yoy: KpiYoYComparison | null;
}

export interface RegionShare {
  region: number;
  label: string;
  count: number;
  volvo_count: number;
}

export interface RegionOption {
  value: number;
  label: string;
}

export interface HpShare {
  bucket: number;
  label: string;
  count: number;
  volvo_count: number;
}

export interface HpOption {
  value: number;
  label: string;
}

export interface FuelShare {
  fuel: string;
  count: number;
  volvo_count: number;
}

export interface PabyggShare {
  pabygg: string;
  label: string;
  count: number;
  volvo_count: number;
}

export interface DispShare {
  bucket: number;
  label: string;
  count: number;
  volvo_count: number;
}

export interface BodyworkShare {
  bodywork: number;
  label: string;
  count: number;
  volvo_count: number;
}

export interface TopBuyerRow {
  owner_name: string;
  count: number;
  focus_count: number;
}

export type ElectricSegmentTrendPoint = ElectricSegmentTrendSeries;

export interface BuyerLoyaltyBucket {
  owner_count: number;
  purchase_count: number;
  focus_count: number;
}

export interface BuyerLoyaltySummary {
  repeat: BuyerLoyaltyBucket;
  new: BuyerLoyaltyBucket;
}

const EMPTY_LOYALTY_BUCKET: BuyerLoyaltyBucket = {
  owner_count: 0,
  purchase_count: 0,
  focus_count: 0,
};

function buildBuyerLoyaltySummary(
  rows: {
    buyer_type: string;
    owner_count: number;
    purchase_count: number;
    focus_count: number;
  }[],
): BuyerLoyaltySummary {
  const repeat =
    rows.find((row) => row.buyer_type === "repeat") ?? EMPTY_LOYALTY_BUCKET;
  const newBuyers =
    rows.find((row) => row.buyer_type === "new") ?? EMPTY_LOYALTY_BUCKET;

  return {
    repeat: {
      owner_count: repeat.owner_count,
      purchase_count: repeat.purchase_count,
      focus_count: repeat.focus_count,
    },
    new: {
      owner_count: newBuyers.owner_count,
      purchase_count: newBuyers.purchase_count,
      focus_count: newBuyers.focus_count,
    },
  };
}

export interface RegistrationsPageData {
  filters: RegistrationsFilters;
  summary: RegistrationsSummary;
  segments: string[];
  makes: string[];
  regions: RegionOption[];
  hpBuckets: HpOption[];
  fuels: string[];
  pabyggOptions: typeof PABYGG_FILTER_OPTIONS;
  bodyworkOptions: typeof BODYWORK_FILTER_OPTIONS;
  dispOptions: typeof DISP_BUCKET_FILTER_OPTIONS;
  chassisOptions: typeof CHASSIS_FILTER_OPTIONS;
  byMonth: MonthlyRegistration[];
  byMake: MakeShare[];
  byRegion: RegionShare[];
  byHp: HpShare[];
  byFuel: FuelShare[];
  byPabygg: PabyggShare[];
  bySegment: SegmentShare[];
  byDisp: DispShare[];
  byBodywork: BodyworkShare[];
  topBuyers: TopBuyerRow[];
  buyerLoyalty: BuyerLoyaltySummary;
  rows: RegistrationRow[];
  totalRows: number;
  totalPages: number;
  error: string | null;
}

/** Fra/til-datoer som brukes når år er valgt uten eksplisitt datointervall. */
export function effectiveRegistrationDates(filters: RegistrationsFilters) {
  if (filters.from || filters.to) {
    return { from: filters.from, to: filters.to };
  }
  const period = resolveRegistrationPeriod(filters);
  return { from: period.from, to: period.to };
}

function buildRegistrationFilterRpcArgs(filters: RegistrationsFilters) {
  const { from: rpcFrom, to: rpcTo } = effectiveRegistrationDates(filters);
  return {
    p_year: filters.year,
    p_from: rpcFrom,
    p_to: rpcTo,
    p_segment: filters.segment,
    p_make: filters.make,
    p_region: filters.region,
    p_hp: filters.hp,
    p_fuel: filters.fuel,
    p_pabygg: filters.pabygg,
    p_bodywork: filters.bodywork,
    p_disp: filters.disp,
    p_chassis: filters.chassis,
  };
}

export interface MarkedTabData {
  byPabygg: PabyggShare[];
  makeCompetitionByMonth: StackedMakeRow[];
  electricTrend: ElectricSegmentTrendPoint[];
  error: string | null;
}

/** Henter diagramdata for fanen Marked & konkurranse. */
export async function getMarkedTabData(
  filters: RegistrationsFilters,
  focusMake: string,
): Promise<MarkedTabData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;
  const filterRpcBase = buildRegistrationFilterRpcArgs(filters);

  const [byPabyggRes, monthMakeRes, electricTrendRes] = await Promise.all([
    rpcClient.rpc(
      "reg_summary_by_pabygg",
      withFocusMake({ ...filterRpcBase, p_month: filters.month }, focusMake),
    ),
    filters.pabygg
      ? rpcClient.rpc(
          "reg_make_share_by_month",
          withFocusMake(filterRpcBase, focusMake),
        )
      : Promise.resolve({ data: [], error: null }),
    rpcClient.rpc(
      "reg_electric_share_by_segment_month",
      withFocusMake(filterRpcBase, focusMake),
    ),
  ]);

  const error =
    byPabyggRes.error?.message ??
    monthMakeRes.error?.message ??
    electricTrendRes.error?.message ??
    null;

  return {
    byPabygg: (byPabyggRes.data ?? []).map((row) => ({
      pabygg: row.pabygg,
      label: getPabyggSegmentLabel(row.pabygg),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    makeCompetitionByMonth: buildStackedMakeRows(
      (monthMakeRes.data ?? []).map((row) => ({
        groupKey: row.month,
        groupLabel: formatMonthLabel(row.month),
        make_name: row.make_name,
        count: row.count,
      })),
      { topGroups: 12, sortGroupsBy: "key" },
    ),
    electricTrend: buildElectricSegmentTrend(
      (electricTrendRes.data ?? []).map((row) => ({
        month: row.month,
        segment: getPabyggSegmentLabel(row.segment),
        total_count: row.total_count,
        electric_count: row.electric_count,
      })),
      { formatMonth: formatMonthLabel },
    ),
    error,
  };
}

export interface DistrictShare {
  district: string;
  region: number | null;
  regionLabel: string | null;
  count: number;
  focus_count: number;
}

export interface RegionBenchmark {
  region: number;
  label: string;
  count: number;
  focus_count: number;
  nationalSharePct: number;
  focusSharePct: number;
}

export interface RegionTabData {
  selectedRegionLabel: string | null;
  scopedSummary: RegistrationsSummary;
  nationalTotal: number;
  nationalFocusShare: number;
  /** Andel av nasjonalt volum når region er valgt. */
  nationalSharePct: number | null;
  activeDistrictCount: number;
  topRegion: { label: string; count: number; focusSharePct: number } | null;
  byRegion: RegionBenchmark[];
  byDistrict: DistrictShare[];
  byMonth: MonthlyRegistration[];
  byMake: MakeShare[];
  topBuyers: TopBuyerRow[];
  buyerLoyalty: BuyerLoyaltySummary;
  error: string | null;
}

/** Henter region/distrikt-data for Regional Sales Manager-fanen. */
export async function getRegionTabData(
  filters: RegistrationsFilters,
  focusMake: string,
): Promise<RegionTabData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;
  const filterRpcBase = buildRegistrationFilterRpcArgs(filters);
  const nationalFilters: RegistrationsFilters = { ...filters, region: null };
  const prevFilters = previousPeriodFilters(filters);

  const [
    scopedSummaryBase,
    prevScopedSummary,
    nationalSummaryBase,
    byRegionRes,
    byDistrictRes,
    byMonthRes,
    byMakeRes,
    topBuyersRes,
    buyerLoyaltyRes,
  ] = await Promise.all([
    fetchRegistrationsSummary(supabase, filters, focusMake),
    prevFilters
      ? fetchRegistrationsSummary(supabase, prevFilters, focusMake)
      : Promise.resolve(null),
    fetchRegistrationsSummary(supabase, nationalFilters, focusMake),
    rpcClient.rpc(
      "reg_summary_by_region",
      withFocusMake(
        {
          ...filterRpcBase,
          p_month: filters.month,
          p_fleet_filter: filters.fleet,
        },
        focusMake,
      ),
    ),
    rpcClient.rpc(
      "reg_summary_by_district",
      withFocusMake(
        {
          ...filterRpcBase,
          p_month: filters.month,
          p_fleet_filter: filters.fleet,
        },
        focusMake,
      ),
    ),
    rpcClient.rpc("reg_summary_by_month", withFocusMake(filterRpcBase, focusMake)),
    rpcClient.rpc("reg_summary_by_make", {
      ...filterRpcBase,
      p_month: filters.month,
    }),
    rpcClient.rpc(
      "reg_top_buyers",
      withFocusMake(
        { ...filterRpcBase, p_month: filters.month, p_limit: 10 },
        focusMake,
      ),
    ),
    rpcClient.rpc(
      "reg_buyer_loyalty",
      withFocusMake({ ...filterRpcBase, p_month: filters.month }, focusMake),
    ),
  ]);

  const error =
    byRegionRes.error?.message ??
    byDistrictRes.error?.message ??
    byMonthRes.error?.message ??
    byMakeRes.error?.message ??
    topBuyersRes.error?.message ??
    buyerLoyaltyRes.error?.message ??
    null;

  const nationalTotal = nationalSummaryBase.total;
  const scopedSummary: RegistrationsSummary = {
    total: scopedSummaryBase.total,
    volvoCount: scopedSummaryBase.volvoCount,
    volvoShare: scopedSummaryBase.volvoShare,
    electricCount: scopedSummaryBase.electricCount,
    electricShare: scopedSummaryBase.electricShare,
    yoy:
      prevFilters && prevScopedSummary
        ? {
            periodLabel: comparisonPeriodLabel(filters),
            total: prevScopedSummary.total,
            volvoCount: prevScopedSummary.volvoCount,
            volvoShare: prevScopedSummary.volvoShare,
            electricCount: prevScopedSummary.electricCount,
            electricShare: prevScopedSummary.electricShare,
          }
        : null,
  };

  const byRegion = (byRegionRes.data ?? [])
    .map((row) => ({
      region: row.region,
      label: getRegionLabel(row.region),
      count: row.count,
      focus_count: row.volvo_count,
      nationalSharePct:
        nationalTotal > 0 ? (row.count / nationalTotal) * 100 : 0,
      focusSharePct:
        row.count > 0 ? (row.volvo_count / row.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topRegion = byRegion[0]
    ? {
        label: byRegion[0].label,
        count: byRegion[0].count,
        focusSharePct: byRegion[0].focusSharePct,
      }
    : null;

  const byDistrict = (byDistrictRes.data ?? []).map((row) => ({
    district: row.district,
    region: row.region,
    regionLabel: row.region != null ? getRegionLabel(row.region) : null,
    count: row.count,
    focus_count: row.focus_count,
  }));

  const nationalSharePct =
    filters.region != null && nationalTotal > 0
      ? (scopedSummary.total / nationalTotal) * 100
      : null;

  return {
    selectedRegionLabel:
      filters.region != null ? getRegionLabel(filters.region) : null,
    scopedSummary,
    nationalTotal,
    nationalFocusShare: nationalSummaryBase.volvoShare,
    nationalSharePct,
    activeDistrictCount: byDistrict.length,
    topRegion: filters.region != null ? null : topRegion,
    byRegion,
    byDistrict,
    byMonth: (byMonthRes.data ?? []).map((row) => ({
      month: row.month,
      count: row.count,
      volvo_count: row.volvo_count,
      label: formatMonthLabel(row.month),
    })),
    byMake: (byMakeRes.data ?? []).slice(0, 8),
    topBuyers: (topBuyersRes.data ?? []).map((row) => ({
      owner_name: row.owner_name,
      count: row.count,
      focus_count: row.focus_count,
    })),
    buyerLoyalty: buildBuyerLoyaltySummary(buyerLoyaltyRes.data ?? []),
    error,
  };
}

interface FilterableQuery<Q> {
  eq: (column: string, value: string | number) => Q;
  is: (column: string, value: null) => Q;
  gt: (column: string, value: string | number) => Q;
  gte: (column: string, value: string | number) => Q;
  lt: (column: string, value: string | number) => Q;
  ilike: (column: string, pattern: string) => Q;
}

/** Samme elektrisitetslogikk som reg_electric_share_by_segment_month. */
const ELECTRIC_FUEL_PATTERN = "%elektr%";

/** Eksklusiv øvre grense (slutten av to-datoen) som ISO-tidsstempel. */
function endOfDayExclusive(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.toISOString().slice(0, 10)}T00:00:00`;
}

function applyRegistrationFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: RegistrationsFilters,
) {
  let q = query
    .eq("transaction_type_id", OFV_TRANSACTION_NEW_REGISTRATION)
    .gte("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG);

  if (filters.from || filters.to) {
    if (filters.from) {
      q = q.gte("transaction_time", `${filters.from}T00:00:00`);
    }
    if (filters.to) {
      q = q.lt("transaction_time", endOfDayExclusive(filters.to));
    }
  } else {
    const { from, to } = resolveRegistrationPeriod(filters);
    q = q
      .gte("transaction_time", `${from}T00:00:00`)
      .lt("transaction_time", endOfDayExclusive(to));
  }

  if (filters.segment) {
    q = q.eq("usage_name", filters.segment);
  }
  if (filters.make) {
    q = q.eq("make_name", filters.make);
  }
  if (filters.region) {
    q = q.eq("sales_region", filters.region);
  }
  if (filters.hp) {
    q = q.eq("hp_bucket", filters.hp);
  }
  if (filters.fuel) {
    q = q.eq("fuel_name", filters.fuel);
  }
  if (filters.pabygg) {
    q = q.eq("pabygg_segment", filters.pabygg);
  }
  if (filters.bodywork != null) {
    q =
      filters.bodywork === BODYWORK_NULL_CODE
        ? q.is("bodywork_code", null)
        : q.eq("bodywork_code", filters.bodywork);
  }
  if (filters.disp) {
    q = q.eq("disp_bucket", filters.disp);
  }
  if (filters.chassis) {
    q = q.eq("trekker_jevnlast", filters.chassis);
  }
  return q;
}

async function fetchRegistrationsSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: RegistrationsFilters,
  focusMake: string,
): Promise<
  Pick<
    RegistrationsSummary,
    "total" | "volvoCount" | "volvoShare" | "electricCount" | "electricShare"
  >
> {
  const [countRes, volvoCountRes, electricCountRes] = await Promise.all([
    applyRegistrationFilters(
      supabase.from("registrations").select("*", { count: "exact", head: true }),
      filters,
    ),
    applyRegistrationFilters(
      supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("make_name", focusMake),
      filters,
    ),
    applyRegistrationFilters(
      supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .ilike("fuel_name", ELECTRIC_FUEL_PATTERN),
      filters,
    ),
  ]);

  const total = countRes.count ?? 0;
  const volvoCount = volvoCountRes.count ?? 0;
  const electricCount = electricCountRes.count ?? 0;

  return {
    total,
    volvoCount,
    volvoShare: total > 0 ? (volvoCount / total) * 100 : 0,
    electricCount,
    electricShare: total > 0 ? (electricCount / total) * 100 : 0,
  };
}

export async function getRegistrationsPageData(
  filters: RegistrationsFilters,
  focusMake = "Volvo",
  tab: RegistrationsTabId = "oversikt",
): Promise<RegistrationsPageData> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;

  const loadOverview = tab === "oversikt";
  const loadKjopere = tab === "kjopere";
  const loadDetaljer = tab === "detaljer";
  const loadCounts = loadOverview || loadDetaljer;

  const prevFilters = previousPeriodFilters(filters);
  const filterRpcBase = buildRegistrationFilterRpcArgs(filters);
  const { from: rpcFrom, to: rpcTo } = effectiveRegistrationDates(filters);

  const countQuery = applyRegistrationFilters(
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    filters,
  );
  const volvoCountQuery = applyRegistrationFilters(
    supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("make_name", focusMake),
    filters,
  );
  const electricCountQuery = applyRegistrationFilters(
    supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .ilike("fuel_name", ELECTRIC_FUEL_PATTERN),
    filters,
  );

  const offset = (filters.page - 1) * REGISTRATIONS_PAGE_SIZE;
  const rowsQuery = applyRegistrationFilters(
    supabase
      .from("registrations")
      .select(
        "registration_number, transaction_time, make_name, model_name, variant_name, usage_name, pabygg_segment, bodywork_code, bodywork_name, maximum_laden_mass_kg, primary_owner_name, primary_owner_postal_code, primary_owner_postal_district, primary_user_name, primary_user_postal_code, primary_user_postal_district",
      )
      .order("transaction_time", { ascending: false })
      .range(offset, offset + REGISTRATIONS_PAGE_SIZE - 1),
    filters,
  );

  const [
    makesRes,
    fuelsRes,
    countRes,
    volvoCountRes,
    electricCountRes,
    prevSummaryRes,
    rowsRes,
    monthlyRes,
    byMakeRes,
    byRegionRes,
    byHpRes,
    byPabyggRes,
    bySegmentRes,
    byDispRes,
    byBodyworkRes,
    topBuyersRes,
    buyerLoyaltyRes,
  ] = await Promise.all([
    rpcClient.rpc("reg_summary_by_make", {
      p_year: filters.year,
      p_segment: filters.segment,
      p_make: null,
      p_from: rpcFrom,
      p_to: rpcTo,
      p_bodywork: filters.bodywork,
    }),
    rpcClient.rpc(
      "reg_summary_by_fuel",
      withFocusMake(
        {
          ...filterRpcBase,
          p_month: filters.month,
        },
        focusMake,
      ),
    ),
    loadCounts ? countQuery : Promise.resolve({ count: 0, error: null }),
    loadCounts ? volvoCountQuery : Promise.resolve({ count: 0, error: null }),
    loadCounts
      ? electricCountQuery
      : Promise.resolve({ count: 0, error: null }),
    loadOverview && prevFilters
      ? fetchRegistrationsSummary(supabase, prevFilters, focusMake)
      : Promise.resolve(null),
    loadDetaljer ? rowsQuery : Promise.resolve({ data: [], error: null }),
    loadOverview
      ? rpcClient.rpc(
          "reg_summary_by_month",
          withFocusMake(filterRpcBase, focusMake),
        )
      : Promise.resolve({ data: [], error: null }),
    loadOverview
      ? rpcClient.rpc("reg_summary_by_make", {
          ...filterRpcBase,
          p_month: filters.month,
        })
      : Promise.resolve({ data: [], error: null }),
    loadOverview
      ? rpcClient.rpc(
          "reg_summary_by_region",
          withFocusMake(
            { ...filterRpcBase, p_month: filters.month },
            focusMake,
          ),
        )
      : Promise.resolve({ data: [], error: null }),
    loadOverview
      ? rpcClient.rpc(
          "reg_summary_by_hp",
          withFocusMake(
            { ...filterRpcBase, p_month: filters.month },
            focusMake,
          ),
        )
      : Promise.resolve({ data: [], error: null }),
    loadOverview
      ? rpcClient.rpc(
          "reg_summary_by_pabygg",
          withFocusMake(
            { ...filterRpcBase, p_month: filters.month },
            focusMake,
          ),
        )
      : Promise.resolve({ data: [], error: null }),
    loadOverview
      ? rpcClient.rpc(
          "reg_summary_by_segment",
          withFocusMake(
            { ...filterRpcBase, p_month: filters.month },
            focusMake,
          ),
        )
      : Promise.resolve({ data: [], error: null }),
    loadOverview
      ? rpcClient.rpc(
          "reg_summary_by_disp",
          withFocusMake(
            { ...filterRpcBase, p_month: filters.month },
            focusMake,
          ),
        )
      : Promise.resolve({ data: [], error: null }),
    loadOverview
      ? rpcClient.rpc(
          "reg_summary_by_bodywork",
          withFocusMake(
            { ...filterRpcBase, p_month: filters.month },
            focusMake,
          ),
        )
      : Promise.resolve({ data: [], error: null }),
    loadKjopere
      ? rpcClient.rpc(
          "reg_top_buyers",
          withFocusMake(
            { ...filterRpcBase, p_month: filters.month, p_limit: 15 },
            focusMake,
          ),
        )
      : Promise.resolve({ data: [], error: null }),
    loadKjopere
      ? rpcClient.rpc(
          "reg_buyer_loyalty",
          withFocusMake(
            { ...filterRpcBase, p_month: filters.month },
            focusMake,
          ),
        )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const totalRows = countRes.count ?? 0;
  const volvoCount = volvoCountRes.count ?? 0;
  const electricCount = electricCountRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / REGISTRATIONS_PAGE_SIZE));

  const yoy =
    loadOverview && prevFilters && prevSummaryRes
      ? {
          periodLabel: comparisonPeriodLabel(filters),
          total: prevSummaryRes.total,
          volvoCount: prevSummaryRes.volvoCount,
          volvoShare: prevSummaryRes.volvoShare,
          electricCount: prevSummaryRes.electricCount,
          electricShare: prevSummaryRes.electricShare,
        }
      : null;

  const error =
    byMakeRes.error?.message ??
    byRegionRes.error?.message ??
    byHpRes.error?.message ??
    byPabyggRes.error?.message ??
    bySegmentRes.error?.message ??
    byDispRes.error?.message ??
    byBodyworkRes.error?.message ??
    monthlyRes.error?.message ??
    makesRes.error?.message ??
    fuelsRes.error?.message ??
    topBuyersRes.error?.message ??
    buyerLoyaltyRes.error?.message ??
    null;

  return {
    filters,
    summary: {
      total: totalRows,
      volvoCount,
      volvoShare: totalRows > 0 ? (volvoCount / totalRows) * 100 : 0,
      electricCount,
      electricShare: totalRows > 0 ? (electricCount / totalRows) * 100 : 0,
      yoy,
    },
    segments: [],
    makes: (makesRes.data ?? []).map((row) => row.make_name),
    regions: REGION_FILTER_OPTIONS,
    hpBuckets: HP_BUCKET_FILTER_OPTIONS,
    fuels: (fuelsRes.data ?? []).map((row) => row.fuel),
    pabyggOptions: PABYGG_FILTER_OPTIONS,
    bodyworkOptions: BODYWORK_FILTER_OPTIONS,
    dispOptions: DISP_BUCKET_FILTER_OPTIONS,
    chassisOptions: CHASSIS_FILTER_OPTIONS,
    byMonth: (monthlyRes.data ?? []).map((row) => ({
      month: row.month,
      count: row.count,
      volvo_count: row.volvo_count,
      label: formatMonthLabel(row.month),
    })),
    byMake: (byMakeRes.data ?? []).slice(0, 10),
    byRegion: (byRegionRes.data ?? []).map((row) => ({
      region: row.region,
      label: getRegionLabel(row.region),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byHp: (byHpRes.data ?? []).map((row) => ({
      bucket: row.bucket,
      label: getHpBucketLabel(row.bucket),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byFuel: (fuelsRes.data ?? []).map((row) => ({
      fuel: row.fuel,
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byPabygg: (byPabyggRes.data ?? []).map((row) => ({
      pabygg: row.pabygg,
      label: getPabyggSegmentLabel(row.pabygg),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    bySegment: (bySegmentRes.data ?? []).map((row) => ({
      segment: row.segment,
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byDisp: (byDispRes.data ?? []).map((row) => ({
      bucket: row.bucket,
      label: getDispBucketLabel(row.bucket),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    byBodywork: (byBodyworkRes.data ?? []).map((row) => ({
      bodywork: row.bodywork_code,
      label: getBodyworkFilterLabel(row.bodywork_code),
      count: row.count,
      volvo_count: row.volvo_count,
    })),
    topBuyers: (topBuyersRes.data ?? []).map((row) => ({
      owner_name: row.owner_name,
      count: row.count,
      focus_count: row.focus_count,
    })),
    buyerLoyalty: buildBuyerLoyaltySummary(buyerLoyaltyRes.data ?? []),
    rows: rowsRes.data ?? [],
    totalRows,
    totalPages,
    error,
  };
}

export const REGISTRATIONS_EXPORT_MAX_ROWS = 50000;

const EXPORT_BATCH_SIZE = 1000;

const REGISTRATION_EXPORT_COLUMNS =
  "registration_number, transaction_time, make_name, model_name, variant_name, usage_name, maximum_laden_mass_kg, sales_region, hp_bucket, fuel_name, pabygg_segment, bodywork_code, bodywork_name, primary_owner_name, primary_owner_postal_code, primary_owner_postal_district, primary_user_name, primary_user_postal_code, primary_user_postal_district";

export async function getAllRegistrationsForExport(
  filters: RegistrationsFilters,
): Promise<{ rows: RegistrationRow[]; truncated: boolean }> {
  const supabase = await createClient();
  const all: RegistrationRow[] = [];
  let truncated = false;

  for (
    let offset = 0;
    offset < REGISTRATIONS_EXPORT_MAX_ROWS;
    offset += EXPORT_BATCH_SIZE
  ) {
    const batchQuery = applyRegistrationFilters(
      supabase
        .from("registrations")
        .select(REGISTRATION_EXPORT_COLUMNS)
        .order("transaction_time", { ascending: false })
        .range(offset, offset + EXPORT_BATCH_SIZE - 1),
      filters,
    );

    const { data, error } = await batchQuery;
    if (error) throw new Error(error.message);

    const batch = (data ?? []) as unknown as RegistrationRow[];
    all.push(...batch);

    if (batch.length < EXPORT_BATCH_SIZE) break;
    if (all.length >= REGISTRATIONS_EXPORT_MAX_ROWS) {
      truncated = true;
      break;
    }
  }

  return { rows: all, truncated };
}
