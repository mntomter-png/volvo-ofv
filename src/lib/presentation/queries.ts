import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { BODYWORK_NULL_CODE } from "@/lib/ofv/segmentation";
import { buildLiveNarratives } from "@/lib/presentation/live-narrative";
import {
  PRESENTATION_META,
  type SlideNarrative,
} from "@/lib/presentation/narrative";
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
            scenarioLabel: estimate.currentYear.scenarioLabel,
          }) as const,
        (err: unknown) =>
          ({
            ok: false as const,
            message: err instanceof Error ? err.message : "TMF-prognose feilet",
          }) as const,
      ),
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
