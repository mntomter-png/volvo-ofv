import { createClient } from "@/lib/supabase/server";
import {
  HEAVY_TRUCK_MIN_KG,
  OFV_TRANSACTION_NEW_REGISTRATION,
} from "@/lib/ofv/constants";
import {
  BODYWORK_NULL_CODE,
  getBodyworkFilterLabel,
  getPabyggSegmentLabel,
  type PabyggSegment,
} from "@/lib/ofv/segmentation";
import type { TmfSegmentForecast, TmfYearEstimateSegment } from "@/lib/tmf/types";

const FOCUS_MAKE = "Volvo";
const TOP_N = 8;
const PAGE_SIZE = 1000;

function parseYearFromIso(transactionTime: string): number {
  return Number.parseInt(transactionTime.slice(0, 4), 10);
}

function lastCompleteMonth(reference: Date): { year: number; month: number } {
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1;
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function formatIsoStartOfMonth(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-01T00:00:00`;
}

export interface TmfBodyworkYearTotals {
  year: number;
  market: number;
  volvo: number;
}

export interface TmfBodyworkMarketVolvo {
  market: number;
  volvo: number;
}

export interface TmfBodyworkDrilldownRow {
  bodyworkCode: number;
  bodyworkLabel: string;
  trailingMarketSharePct: number;
  trailingVolvoSharePct: number;
  yearly: TmfBodyworkYearTotals[];
  ytd: TmfBodyworkMarketVolvo;
  forecastCurrent: TmfBodyworkMarketVolvo;
  forecastNext: TmfBodyworkMarketVolvo;
}

export interface TmfBodyworkDrilldownResult {
  pabygg: PabyggSegment;
  pabyggLabel: string;
  years: number[];
  currentYear: number;
  /** Siste fullførte måned i YTD (1–12). */
  ytdThroughMonth: number;
  nextYear: number;
  rows: TmfBodyworkDrilldownRow[];
  others?: TmfBodyworkDrilldownRow;
  /** Antall råregistreringer brukt i aggregeringen (etter paginering). */
  rowCount: number;
}

type DrilldownRegistrationRow = {
  transaction_time: string;
  bodywork_code: number | null;
  bodywork_name: string | null;
  make_name: string;
};

async function fetchAllBodyworkRows(
  pabygg: PabyggSegment,
  fromIso: string,
  toExclusiveIso: string,
): Promise<DrilldownRegistrationRow[]> {
  const supabase = await createClient();
  const all: DrilldownRegistrationRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("registrations")
      .select("transaction_time, bodywork_code, bodywork_name, make_name")
      .eq("transaction_type_id", OFV_TRANSACTION_NEW_REGISTRATION)
      .gte("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG)
      .eq("pabygg_segment", pabygg)
      .gte("transaction_time", fromIso)
      .lt("transaction_time", toExclusiveIso)
      .order("transaction_time", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const batch = (data ?? []) as DrilldownRegistrationRow[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return all;
}

function allocateByTrailing(
  segmentMarket: number,
  segmentVolvo: number,
  trailingMarket: number,
  trailingVolvo: number,
  trailingMarketTotal: number,
  trailingVolvoTotal: number,
): TmfBodyworkMarketVolvo {
  return {
    market: trailingMarketTotal > 0 ? segmentMarket * (trailingMarket / trailingMarketTotal) : 0,
    volvo: trailingVolvoTotal > 0 ? segmentVolvo * (trailingVolvo / trailingVolvoTotal) : 0,
  };
}

/**
 * Drilldown på underliggende OFV `AdditionalBodyworks`-koder innen et pabygg-segment.
 *
 * - Historikk: års-aggregert fra OFV-registreringer (N3 ≥16t, transaction_type_id='10')
 * - YTD: inneværende år til siste fullførte måned
 * - Prognose inneværende/neste år: fordelt segmentestimat ned på bodywork via trailing 12m
 */
export async function getTmfBodyworkDrilldown(
  pabygg: PabyggSegment,
  segmentForecastNext: TmfYearEstimateSegment,
  segmentForecastCurrent: TmfSegmentForecast,
  years: number[],
): Promise<TmfBodyworkDrilldownResult> {
  const reference = new Date();
  const currentYear = reference.getFullYear();
  const lastYear = currentYear - 1;
  const showYears = years.length > 0 ? years : [lastYear];

  const endMonth = lastCompleteMonth(reference);
  // Match TMF baseline: rullerende 12 mnd med "fullførte" måneder før reference.
  const startMonth = addMonths(endMonth.year, endMonth.month, -(12 - 1));
  const startStartIso = formatIsoStartOfMonth(startMonth.year, startMonth.month);
  // End exclusive: first day of the month after endMonth.
  const endExclusive = addMonths(endMonth.year, endMonth.month, 1);
  const endExclusiveIso = formatIsoStartOfMonth(endExclusive.year, endExclusive.month);

  const queryStartYear = Math.min(...showYears, startMonth.year, currentYear);
  const queryStartIso = formatIsoStartOfMonth(queryStartYear, 1);

  const data = await fetchAllBodyworkRows(pabygg, queryStartIso, endExclusiveIso);

  type Acc = {
    label: string | null;
    yearly: Map<number, { market: number; volvo: number }>;
    ytd: { market: number; volvo: number };
    trailing: { market: number; volvo: number };
  };

  const accByCode = new Map<number, Acc>();

  const trailingStart = startStartIso;
  const trailingEnd = endExclusiveIso;
  const ytdStartIso = formatIsoStartOfMonth(currentYear, 1);

  for (const row of data) {
    const transactionTime = row.transaction_time;
    const year = parseYearFromIso(transactionTime);

    const rawCode = row.bodywork_code;
    const bodyworkCode = rawCode ?? BODYWORK_NULL_CODE;
    const bodyworkName = row.bodywork_name;
    const label = bodyworkName ?? getBodyworkFilterLabel(bodyworkCode) ?? null;

    const isVolvo = row.make_name === FOCUS_MAKE;

    const acc = accByCode.get(bodyworkCode) ?? {
      label,
      yearly: new Map(),
      ytd: { market: 0, volvo: 0 },
      trailing: { market: 0, volvo: 0 },
    };

    accByCode.set(bodyworkCode, acc);
    if (acc.label == null && label != null) acc.label = label;

    if (showYears.includes(year)) {
      const y = acc.yearly.get(year) ?? { market: 0, volvo: 0 };
      y.market += 1;
      if (isVolvo) y.volvo += 1;
      acc.yearly.set(year, y);
    }

    if (transactionTime >= ytdStartIso && transactionTime < trailingEnd) {
      acc.ytd.market += 1;
      if (isVolvo) acc.ytd.volvo += 1;
    }

    if (transactionTime >= trailingStart && transactionTime < trailingEnd) {
      acc.trailing.market += 1;
      if (isVolvo) acc.trailing.volvo += 1;
    }
  }

  const trailingMarketTotal = Array.from(accByCode.values()).reduce(
    (sum, v) => sum + v.trailing.market,
    0,
  );
  const trailingVolvoTotal = Array.from(accByCode.values()).reduce(
    (sum, v) => sum + v.trailing.volvo,
    0,
  );

  const currentMarket = segmentForecastCurrent.annualAdjustedForecast;
  const currentVolvo =
    currentMarket * (segmentForecastCurrent.baseline.volvoSharePct / 100);

  const allRows = Array.from(accByCode.entries()).map(([bodyworkCode, acc]) => {
    const bodyworkLabel = acc.label ?? getBodyworkFilterLabel(bodyworkCode) ?? String(bodyworkCode);
    const yearly = showYears.map((year) => {
      const y = acc.yearly.get(year) ?? { market: 0, volvo: 0 };
      return { year, market: y.market, volvo: y.volvo };
    });

    const trailingMarketSharePct =
      trailingMarketTotal > 0 ? (acc.trailing.market / trailingMarketTotal) * 100 : 0;
    const trailingVolvoSharePct =
      trailingVolvoTotal > 0 ? (acc.trailing.volvo / trailingVolvoTotal) * 100 : 0;

    return {
      bodyworkCode,
      bodyworkLabel,
      trailingMarketSharePct,
      trailingVolvoSharePct,
      yearly,
      ytd: { market: acc.ytd.market, volvo: acc.ytd.volvo },
      forecastCurrent: allocateByTrailing(
        currentMarket,
        currentVolvo,
        acc.trailing.market,
        acc.trailing.volvo,
        trailingMarketTotal,
        trailingVolvoTotal,
      ),
      forecastNext: allocateByTrailing(
        segmentForecastNext.annualMarket,
        segmentForecastNext.annualVolvo,
        acc.trailing.market,
        acc.trailing.volvo,
        trailingMarketTotal,
        trailingVolvoTotal,
      ),
    } satisfies TmfBodyworkDrilldownRow;
  });

  allRows.sort((a, b) => b.trailingMarketSharePct - a.trailingMarketSharePct);
  const rows = allRows.slice(0, TOP_N);
  const rest = allRows.slice(TOP_N);

  const others =
    rest.length > 0
      ? {
          bodyworkCode: -999,
          bodyworkLabel: "Andre",
          trailingMarketSharePct: rest.reduce((s, r) => s + r.trailingMarketSharePct, 0),
          trailingVolvoSharePct: rest.reduce((s, r) => s + r.trailingVolvoSharePct, 0),
          yearly: showYears.map((year) => ({
            year,
            market: rest.reduce((s, r) => s + (r.yearly.find((y) => y.year === year)?.market ?? 0), 0),
            volvo: rest.reduce((s, r) => s + (r.yearly.find((y) => y.year === year)?.volvo ?? 0), 0),
          })),
          ytd: {
            market: rest.reduce((s, r) => s + r.ytd.market, 0),
            volvo: rest.reduce((s, r) => s + r.ytd.volvo, 0),
          },
          forecastCurrent: {
            market: rest.reduce((s, r) => s + r.forecastCurrent.market, 0),
            volvo: rest.reduce((s, r) => s + r.forecastCurrent.volvo, 0),
          },
          forecastNext: {
            market: rest.reduce((s, r) => s + r.forecastNext.market, 0),
            volvo: rest.reduce((s, r) => s + r.forecastNext.volvo, 0),
          },
        }
      : undefined;

  return {
    pabygg,
    pabyggLabel: getPabyggSegmentLabel(pabygg),
    years: showYears,
    currentYear,
    ytdThroughMonth: endMonth.year === currentYear ? endMonth.month : 0,
    nextYear: currentYear + 1,
    rows,
    others,
    rowCount: data.length,
  };
}
