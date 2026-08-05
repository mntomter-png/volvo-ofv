import type { SupabaseClient } from "@supabase/supabase-js";

import { withFocusMake } from "@/lib/brand/focus-make";
import {
  BODYWORK_NULL_CODE,
  getHpBucketLabel,
  getRegionLabel,
  POSTAL_SALES_REGIONS,
} from "@/lib/ofv/segmentation";
import { buildLiveNarratives } from "@/lib/presentation/live-narrative";
import {
  PRESENTATION_META,
  type SlideNarrative,
} from "@/lib/presentation/narrative";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getTmfEstimate } from "@/lib/tmf/queries";

export interface NamedCount {
  name: string;
  count: number;
}

export interface YearVolume {
  year: number;
  count: number;
  focusCount: number;
  electricCount: number;
  partial?: boolean;
  /** TMF justert årsprognose — kun satt for inneværende (delvise) år. */
  forecastCount?: number | null;
}

export interface MakeSharePeriod {
  label: string;
  year: number;
  from: string;
  to: string;
  total: number;
  rows: NamedCount[];
}

export interface SegmentMakeShare {
  key: string;
  label: string;
  total: number;
  focusCount: number;
  focusShare: number;
  topCompetitor: string | null;
  topCompetitorShare: number;
  rows: NamedCount[];
}

export interface FuelMixRow {
  fuel: string;
  count: number;
  share: number;
}

export interface BodyworkFuelShare {
  label: string;
  total: number;
  electricCount: number;
  electricShare: number;
  gasCount: number;
  gasShare: number;
}

export interface RegionShareRow {
  region: number;
  label: string;
  count: number;
  focusCount: number;
  focusShare: number;
}

export interface HpShareRow {
  bucket: number;
  label: string;
  count: number;
  focusCount: number;
  focusShare: number;
}

export interface LoyaltyBucket {
  owners: number;
  purchases: number;
  focusCount: number;
}

export interface LoyaltySummary {
  repeat: LoyaltyBucket;
  new: LoyaltyBucket;
  conquest: LoyaltyBucket;
}

export interface FlowStockShare {
  flowTotal: number;
  flowFocusCount: number;
  flowShare: number;
  stockTotal: number;
  stockFocusCount: number;
  stockShare: number;
}

export interface TmfNextYearSummary {
  year: number;
  scenarioLabel: string;
  annualMarket: number;
  annualVolvo: number;
  volvoSharePct: number;
  annualEmob: number;
  emobSharePct: number;
  marketP10: number;
  marketP90: number;
}

export interface TmfSegmentForecastRow {
  key: string;
  label: string;
  annualMarket: number;
  annualVolvo: number;
  volvoSharePct: number;
  emobSharePct: number;
}

export interface PresentationDeckData {
  generatedAt: string;
  focusMake: string;
  periodLabel: string;
  ytdFrom: string;
  ytdTo: string;
  currentYear: number;
  volumeByYear: YearVolume[];
  /** TMF justert årsprognose for inneværende år (basis), null ved feil/utilgjengelig. */
  tmfAnnualForecast: number | null;
  tmfScenarioLabel: string | null;
  makeSharePeriods: MakeSharePeriod[];
  segmentShares: SegmentMakeShare[];
  fuelMix: FuelMixRow[];
  fossilFreeShare: number;
  electricByYear: YearVolume[];
  electricMakeShare: MakeSharePeriod;
  electricByBodywork: BodyworkFuelShare[];
  gasByBodywork: BodyworkFuelShare[];
  gasMakeShare: MakeSharePeriod;
  flowStock: FlowStockShare;
  regionShares: RegionShareRow[];
  nationalFocusShare: number;
  hpShares: HpShareRow[];
  loyalty: LoyaltySummary;
  tmfNextYear: TmfNextYearSummary | null;
  tmfSegmentForecast: TmfSegmentForecastRow[];
  meta: typeof PRESENTATION_META;
  narratives: SlideNarrative[];
  error: string | null;
}

type RpcClient = SupabaseClient<Database>;

const SEGMENT_SPECS: { key: string; label: string; bodywork: number }[] = [
  { key: "tipp", label: "Tipp", bodywork: 10 },
  { key: "kran", label: "Kran", bodywork: 26 },
  { key: "krokløft", label: "Krokløft", bodywork: 9 },
  { key: "renovasjon", label: "Renovasjon", bodywork: 18 },
  { key: "trekkvogn", label: "Trekkvogn", bodywork: BODYWORK_NULL_CODE },
];

const SKAP_CODES = [3, 4, 5] as const;
const BEV_BODYWORK_SPECS: { label: string; codes: number[] }[] = [
  { label: "Skap (inkl. kjøl/frys)", codes: [...SKAP_CODES] },
  { label: "Tipp", codes: [10] },
  { label: "Kran", codes: [26] },
  { label: "Trekkvogn", codes: [BODYWORK_NULL_CODE] },
  { label: "Renovasjon", codes: [18] },
  { label: "Konteiner", codes: [8] },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function emptyRpcArgs(year: number, from: string | null, to: string | null) {
  return {
    p_year: year,
    p_from: from,
    p_to: to,
    p_segment: null as string | null,
    p_make: null as string | null,
    p_region: null as number | null,
    p_hp: null as number | null,
    p_fuel: null as string | null,
    p_pabygg: null as string | null,
    p_disp: null as number | null,
    p_chassis: null as string | null,
    p_bodywork: null as number | null,
  };
}

function shareRows(rows: { make_name: string; count: number }[]): NamedCount[] {
  return rows
    .map((row) => ({ name: row.make_name, count: row.count }))
    .sort((a, b) => b.count - a.count);
}

function makePeriod(
  label: string,
  year: number,
  from: string,
  to: string,
  rows: { make_name: string; count: number }[],
): MakeSharePeriod {
  const mapped = shareRows(rows);
  return {
    label,
    year,
    from,
    to,
    total: mapped.reduce((sum, row) => sum + row.count, 0),
    rows: mapped,
  };
}

function focusShare(
  rows: NamedCount[],
  focusMake: string,
): { focusCount: number; focusShare: number; topCompetitor: string | null; topCompetitorShare: number } {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const focusCount = rows.find((row) => row.name === focusMake)?.count ?? 0;
  const competitor = rows.find((row) => row.name !== focusMake) ?? null;
  return {
    focusCount,
    focusShare: total > 0 ? focusCount / total : 0,
    topCompetitor: competitor?.name ?? null,
    topCompetitorShare: total > 0 && competitor ? competitor.count / total : 0,
  };
}

async function fetchMakeShare(
  rpc: RpcClient,
  year: number,
  from: string | null,
  to: string | null,
  extra: Partial<ReturnType<typeof emptyRpcArgs>> = {},
) {
  return rpc.rpc("reg_summary_by_make", {
    ...emptyRpcArgs(year, from, to),
    ...extra,
  });
}

async function fetchBodyworkTotals(
  rpc: RpcClient,
  year: number,
  from: string,
  to: string,
  fuel: string | null,
) {
  return rpc.rpc("reg_summary_by_bodywork", {
    ...emptyRpcArgs(year, from, to),
    p_fuel: fuel,
  });
}

const EMPTY_LOYALTY_BUCKET: LoyaltyBucket = {
  owners: 0,
  purchases: 0,
  focusCount: 0,
};

function emptyLoyalty(): LoyaltySummary {
  return {
    repeat: { ...EMPTY_LOYALTY_BUCKET },
    new: { ...EMPTY_LOYALTY_BUCKET },
    conquest: { ...EMPTY_LOYALTY_BUCKET },
  };
}

function emptyFlowStock(): FlowStockShare {
  return {
    flowTotal: 0,
    flowFocusCount: 0,
    flowShare: 0,
    stockTotal: 0,
    stockFocusCount: 0,
    stockShare: 0,
  };
}

function parseLoyalty(
  rows: {
    buyer_type: string;
    owner_count: number;
    purchase_count: number;
    focus_count: number;
  }[],
): LoyaltySummary {
  const pick = (type: string): LoyaltyBucket => {
    const row = rows.find((item) => item.buyer_type === type);
    if (!row) return { ...EMPTY_LOYALTY_BUCKET };
    return {
      owners: row.owner_count,
      purchases: row.purchase_count,
      focusCount: row.focus_count,
    };
  };
  return {
    repeat: pick("repeat"),
    new: pick("new"),
    conquest: pick("conquest"),
  };
}

function makeFocusShare(
  rows: { make_name: string; count: number }[],
  focusMake: string,
): { total: number; focusCount: number; share: number } {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const focusCount =
    rows.find((row) => row.make_name === focusMake)?.count ?? 0;
  return {
    total,
    focusCount,
    share: total > 0 ? focusCount / total : 0,
  };
}

export async function getPresentationDeckData(
  focusMake: string,
): Promise<PresentationDeckData> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const ytdFrom = `${currentYear}-01-01`;
  const ytdTo = isoDate(today);
  const historyFrom = "2019-01-01";

  const emptyBase = {
    generatedAt: today.toISOString(),
    focusMake,
    periodLabel: `YTD ${currentYear} (t.o.m. ${ytdTo})`,
    ytdFrom,
    ytdTo,
    currentYear,
    volumeByYear: [] as YearVolume[],
    tmfAnnualForecast: null as number | null,
    tmfScenarioLabel: null as string | null,
    makeSharePeriods: [] as MakeSharePeriod[],
    segmentShares: [] as SegmentMakeShare[],
    fuelMix: [] as FuelMixRow[],
    fossilFreeShare: 0,
    electricByYear: [] as YearVolume[],
    electricMakeShare: makePeriod("El YTD", currentYear, ytdFrom, ytdTo, []),
    electricByBodywork: [] as BodyworkFuelShare[],
    gasByBodywork: [] as BodyworkFuelShare[],
    gasMakeShare: makePeriod("Gass YTD", currentYear, ytdFrom, ytdTo, []),
    flowStock: emptyFlowStock(),
    regionShares: [] as RegionShareRow[],
    nationalFocusShare: 0,
    hpShares: [] as HpShareRow[],
    loyalty: emptyLoyalty(),
    tmfNextYear: null as TmfNextYearSummary | null,
    tmfSegmentForecast: [] as TmfSegmentForecastRow[],
  };

  const empty: PresentationDeckData = {
    ...emptyBase,
    meta: PRESENTATION_META,
    narratives: buildLiveNarratives(emptyBase),
    error: null,
  };

  try {
    const supabase = await createClient();
    const rpc = supabase as unknown as RpcClient;

    const ytdArgs = emptyRpcArgs(currentYear, ytdFrom, ytdTo);
    const [
      monthAllRes,
      monthElectricRes,
      make2019Res,
      make2025Res,
      makeYtdRes,
      fuelYtdRes,
      electricMakeRes,
      gasMakeRes,
      bodyworkAllRes,
      bodyworkElectricRes,
      bodyworkGasRes,
      tmfSettled,
      regionRes,
      hpRes,
      loyaltyRes,
      flowMakeRes,
      stockMakeRes,
      ...segmentMakeResults
    ] = await Promise.all([
      rpc.rpc("reg_summary_by_month", {
        ...emptyRpcArgs(2019, historyFrom, ytdTo),
      }),
      rpc.rpc("reg_summary_by_month", {
        ...emptyRpcArgs(2022, "2022-01-01", ytdTo),
        p_fuel: "Elektrisitet",
      }),
      fetchMakeShare(rpc, 2019, "2019-01-01", "2019-12-31"),
      fetchMakeShare(rpc, 2025, "2025-01-01", "2025-12-31"),
      fetchMakeShare(rpc, currentYear, ytdFrom, ytdTo),
      rpc.rpc("reg_summary_by_fuel", {
        ...emptyRpcArgs(currentYear, ytdFrom, ytdTo),
      }),
      fetchMakeShare(rpc, currentYear, ytdFrom, ytdTo, {
        p_fuel: "Elektrisitet",
      }),
      fetchMakeShare(rpc, currentYear, ytdFrom, ytdTo, { p_fuel: "Gass" }),
      fetchBodyworkTotals(rpc, currentYear, ytdFrom, ytdTo, null),
      fetchBodyworkTotals(rpc, currentYear, ytdFrom, ytdTo, "Elektrisitet"),
      fetchBodyworkTotals(rpc, currentYear, ytdFrom, ytdTo, "Gass"),
      getTmfEstimate({ scenarioId: "basis" }).then(
        (estimate) =>
          ({
            ok: true as const,
            year: estimate.currentYear.year,
            annualAdjustedForecast:
              estimate.currentYear.total.annualAdjustedForecast,
            scenarioLabel: estimate.scenarioLabel,
            nextYear: estimate.nextYear,
            confidence: estimate.confidence,
          }) as const,
        (err: unknown) =>
          ({
            ok: false as const,
            message: err instanceof Error ? err.message : "TMF-prognose feilet",
          }) as const,
      ),
      rpc.rpc(
        "reg_summary_by_region",
        withFocusMake(ytdArgs, focusMake),
      ),
      rpc.rpc("reg_summary_by_hp", withFocusMake(ytdArgs, focusMake)),
      rpc.rpc(
        "reg_buyer_loyalty",
        withFocusMake(
          { ...ytdArgs, p_customer_party: "user" },
          focusMake,
        ),
      ),
      rpc.rpc("dash_registrations_by_make", {
        p_segment: null,
        p_region: null,
        p_pabygg: null,
      }),
      rpc.rpc("dash_population_by_make", {
        p_segment: null,
        p_region: null,
        p_pabygg: null,
      }),
      ...SEGMENT_SPECS.map((spec) =>
        fetchMakeShare(rpc, currentYear, ytdFrom, ytdTo, {
          p_bodywork: spec.bodywork,
        }),
      ),
    ]);

    const tmfAnnualForecast =
      tmfSettled.ok && tmfSettled.year === currentYear
        ? Math.round(tmfSettled.annualAdjustedForecast)
        : null;
    const tmfScenarioLabel = tmfSettled.ok
      ? tmfSettled.scenarioLabel
      : null;

    const tmfNextYear: TmfNextYearSummary | null = tmfSettled.ok
      ? {
          year: tmfSettled.nextYear.year,
          scenarioLabel: tmfSettled.scenarioLabel,
          annualMarket: Math.round(tmfSettled.nextYear.total.annualMarket),
          annualVolvo: Math.round(tmfSettled.nextYear.total.annualVolvo),
          volvoSharePct: tmfSettled.nextYear.total.volvoSharePct,
          annualEmob: Math.round(tmfSettled.nextYear.total.annualEmob),
          emobSharePct: tmfSettled.nextYear.total.emobSharePct,
          marketP10: Math.round(tmfSettled.confidence.market.p10),
          marketP90: Math.round(tmfSettled.confidence.market.p90),
        }
      : null;

    const tmfSegmentForecast: TmfSegmentForecastRow[] = tmfSettled.ok
      ? [...tmfSettled.nextYear.segments]
          .map((seg) => ({
            key: String(seg.pabygg),
            label: seg.label,
            annualMarket: Math.round(seg.annualMarket),
            annualVolvo: Math.round(seg.annualVolvo),
            volvoSharePct: seg.volvoSharePct,
            emobSharePct: seg.emobSharePct,
          }))
          .sort((a, b) => b.annualMarket - a.annualMarket)
      : [];

    const errors = [
      monthAllRes.error,
      monthElectricRes.error,
      make2019Res.error,
      make2025Res.error,
      makeYtdRes.error,
      fuelYtdRes.error,
      electricMakeRes.error,
      gasMakeRes.error,
      bodyworkAllRes.error,
      bodyworkElectricRes.error,
      bodyworkGasRes.error,
      regionRes.error,
      hpRes.error,
      loyaltyRes.error,
      flowMakeRes.error,
      stockMakeRes.error,
      ...segmentMakeResults.map((res) => res.error),
    ]
      .map((err) => err?.message)
      .filter(Boolean);

    const volumeMap = new Map<number, YearVolume>();
    for (const row of monthAllRes.data ?? []) {
      const year = Number.parseInt(String(row.month).slice(0, 4), 10);
      if (!Number.isFinite(year)) continue;
      const current = volumeMap.get(year) ?? {
        year,
        count: 0,
        focusCount: 0,
        electricCount: 0,
      };
      current.count += row.count;
      current.focusCount += row.volvo_count;
      volumeMap.set(year, current);
    }
    for (const row of monthElectricRes.data ?? []) {
      const year = Number.parseInt(String(row.month).slice(0, 4), 10);
      if (!Number.isFinite(year)) continue;
      const current = volumeMap.get(year) ?? {
        year,
        count: 0,
        focusCount: 0,
        electricCount: 0,
      };
      current.electricCount += row.count;
      volumeMap.set(year, current);
    }

    const volumeByYear = [...volumeMap.values()]
      .sort((a, b) => a.year - b.year)
      .map((row) => ({
        ...row,
        partial: row.year === currentYear,
        forecastCount:
          row.year === currentYear ? tmfAnnualForecast : null,
      }));

    const electricByYear = volumeByYear
      .filter((row) => row.year >= 2022)
      .map((row) => ({
        year: row.year,
        count: row.electricCount,
        focusCount: 0,
        electricCount: row.electricCount,
        partial: row.partial,
      }));

    const fuelRows = (fuelYtdRes.data ?? []).map((row) => ({
      fuel: row.fuel,
      count: row.count,
    }));
    const fuelTotal = fuelRows.reduce((sum, row) => sum + row.count, 0);
    const fuelMix: FuelMixRow[] = fuelRows
      .map((row) => ({
        fuel: row.fuel,
        count: row.count,
        share: fuelTotal > 0 ? row.count / fuelTotal : 0,
      }))
      .sort((a, b) => b.count - a.count);
    const fossilFreeShare =
      fuelTotal > 0
        ? fuelRows
            .filter((row) => /elektr|gass/i.test(row.fuel))
            .reduce((sum, row) => sum + row.count, 0) / fuelTotal
        : 0;

    const bodyworkTotalMap = new Map<number, number>();
    for (const row of bodyworkAllRes.data ?? []) {
      bodyworkTotalMap.set(row.bodywork_code, row.count);
    }
    const bodyworkElectricMap = new Map<number, number>();
    for (const row of bodyworkElectricRes.data ?? []) {
      bodyworkElectricMap.set(row.bodywork_code, row.count);
    }
    const bodyworkGasMap = new Map<number, number>();
    for (const row of bodyworkGasRes.data ?? []) {
      bodyworkGasMap.set(row.bodywork_code, row.count);
    }

    function aggregateBodywork(codes: number[], label: string): BodyworkFuelShare {
      const total = codes.reduce(
        (sum, code) => sum + (bodyworkTotalMap.get(code) ?? 0),
        0,
      );
      const electricCount = codes.reduce(
        (sum, code) => sum + (bodyworkElectricMap.get(code) ?? 0),
        0,
      );
      const gasCount = codes.reduce(
        (sum, code) => sum + (bodyworkGasMap.get(code) ?? 0),
        0,
      );
      return {
        label,
        total,
        electricCount,
        electricShare: total > 0 ? electricCount / total : 0,
        gasCount,
        gasShare: total > 0 ? gasCount / total : 0,
      };
    }

    const segmentShares: SegmentMakeShare[] = SEGMENT_SPECS.map((spec, index) => {
      const rows = shareRows(segmentMakeResults[index]?.data ?? []);
      const stats = focusShare(rows, focusMake);
      return {
        key: spec.key,
        label: spec.label,
        total: rows.reduce((sum, row) => sum + row.count, 0),
        rows,
        ...stats,
      };
    }).sort((a, b) => b.focusShare - a.focusShare || b.total - a.total);

    const postalRegions = new Set<number>(POSTAL_SALES_REGIONS);
    const regionShares: RegionShareRow[] = (regionRes.data ?? [])
      .filter((row) => postalRegions.has(row.region))
      .map((row) => ({
        region: row.region,
        label: getRegionLabel(row.region),
        count: row.count,
        focusCount: row.volvo_count,
        focusShare: row.count > 0 ? row.volvo_count / row.count : 0,
      }))
      .sort((a, b) => b.focusShare - a.focusShare || b.count - a.count);

    const nationalFocusShare =
      regionShares.reduce((sum, row) => sum + row.count, 0) > 0
        ? regionShares.reduce((sum, row) => sum + row.focusCount, 0) /
          regionShares.reduce((sum, row) => sum + row.count, 0)
        : 0;

    const hpShares: HpShareRow[] = (hpRes.data ?? [])
      .map((row) => ({
        bucket: row.bucket,
        label: getHpBucketLabel(row.bucket),
        count: row.count,
        focusCount: row.volvo_count,
        focusShare: row.count > 0 ? row.volvo_count / row.count : 0,
      }))
      .sort((a, b) => a.bucket - b.bucket);

    const loyalty = parseLoyalty(loyaltyRes.data ?? []);

    const flowStats = makeFocusShare(flowMakeRes.data ?? [], focusMake);
    const stockStats = makeFocusShare(stockMakeRes.data ?? [], focusMake);
    const flowStock: FlowStockShare = {
      flowTotal: flowStats.total,
      flowFocusCount: flowStats.focusCount,
      flowShare: flowStats.share,
      stockTotal: stockStats.total,
      stockFocusCount: stockStats.focusCount,
      stockShare: stockStats.share,
    };

    const deck = {
      generatedAt: today.toISOString(),
      focusMake,
      periodLabel: `YTD ${currentYear} (t.o.m. ${ytdTo})`,
      ytdFrom,
      ytdTo,
      currentYear,
      volumeByYear,
      tmfAnnualForecast,
      tmfScenarioLabel,
      makeSharePeriods: [
        makePeriod("2019", 2019, "2019-01-01", "2019-12-31", make2019Res.data ?? []),
        makePeriod("2025", 2025, "2025-01-01", "2025-12-31", make2025Res.data ?? []),
        makePeriod(
          `YTD ${currentYear}`,
          currentYear,
          ytdFrom,
          ytdTo,
          makeYtdRes.data ?? [],
        ),
      ],
      segmentShares,
      fuelMix,
      fossilFreeShare,
      electricByYear,
      electricMakeShare: makePeriod(
        `El YTD ${currentYear}`,
        currentYear,
        ytdFrom,
        ytdTo,
        electricMakeRes.data ?? [],
      ),
      electricByBodywork: BEV_BODYWORK_SPECS.map((spec) =>
        aggregateBodywork(spec.codes, spec.label),
      ).sort((a, b) => b.electricShare - a.electricShare || b.total - a.total),
      gasByBodywork: [
        aggregateBodywork([18], "Renovasjon"),
        aggregateBodywork([8], "Konteiner"),
        aggregateBodywork([...SKAP_CODES], "Skap"),
        aggregateBodywork([BODYWORK_NULL_CODE], "Trekkvogn"),
      ].sort((a, b) => b.gasShare - a.gasShare || b.total - a.total),
      gasMakeShare: makePeriod(
        `Gass YTD ${currentYear}`,
        currentYear,
        ytdFrom,
        ytdTo,
        gasMakeRes.data ?? [],
      ),
      flowStock,
      regionShares,
      nationalFocusShare,
      hpShares,
      loyalty,
      tmfNextYear,
      tmfSegmentForecast,
    };

    return {
      ...deck,
      meta: PRESENTATION_META,
      narratives: buildLiveNarratives(deck),
      error: errors[0] ?? null,
    };
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : "Ukjent feil",
    };
  }
}
