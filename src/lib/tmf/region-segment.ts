import { createClient } from "@/lib/supabase/server";
import { HEAVY_TRUCK_MIN_KG, OFV_TRANSACTION_NEW_REGISTRATION } from "@/lib/ofv/constants";
import { getRegionLabel, type PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfYearEstimate } from "@/lib/tmf/types";

const FOCUS_MAKE = "Volvo";

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

export interface TmfRegionSegmentCell {
  region: number;
  market: number;
  volvo: number;
}

export interface TmfRegionSegmentForecastRow {
  region: number;
  label: string;
  cells: Record<string, TmfRegionSegmentCell>;
}

export interface TmfRegionSegmentForecastResult {
  regions: TmfRegionSegmentForecastRow[];
  segments: string[];
}

/**
 * Region × segment forecast for neste år (P50).
 *
 * I v1 fordeler vi segment-forecast ned på region basert på trailing 12m andeler
 * for marked og Volvo separat.
 */
export async function getTmfRegionSegmentForecastP50(
  pabyggSegments: readonly PabyggSegment[],
  nextYear: TmfYearEstimate,
): Promise<TmfRegionSegmentForecastResult> {
  const reference = new Date();

  const endMonth = lastCompleteMonth(reference);
  const startMonth = addMonths(endMonth.year, endMonth.month, -(12 - 1));

  const trailingStartIso = formatIsoStartOfMonth(startMonth.year, startMonth.month);
  const endExclusiveMonth = addMonths(endMonth.year, endMonth.month, 1);
  const trailingEndExclusiveIso = formatIsoStartOfMonth(
    endExclusiveMonth.year,
    endExclusiveMonth.month,
  );

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("registrations")
    .select("sales_region, pabygg_segment, make_name")
    .eq("transaction_type_id", OFV_TRANSACTION_NEW_REGISTRATION)
    .gte("maximum_laden_mass_kg", HEAVY_TRUCK_MIN_KG)
    .in("pabygg_segment", pabyggSegments as string[])
    .gte("transaction_time", trailingStartIso)
    .lt("transaction_time", trailingEndExclusiveIso);

  if (error) throw new Error(error.message);

  type Bucket = { market: number; volvo: number };
  const bySegmentRegion = new Map<string, Map<number, Bucket>>();
  const regionsSet = new Set<number>();
  const segmentTotals = new Map<string, { market: number; volvo: number }>();

  for (const row of data ?? []) {
    const r = (row as { sales_region: number | null }).sales_region;
    const seg = (row as { pabygg_segment: string }).pabygg_segment;
    if (r == null) continue;

    const region = r;
    const regionMap = bySegmentRegion.get(seg) ?? new Map<number, Bucket>();
    const bucket = regionMap.get(region) ?? { market: 0, volvo: 0 };

    bucket.market += 1;
    if ((row as { make_name: string }).make_name === FOCUS_MAKE) bucket.volvo += 1;

    regionMap.set(region, bucket);
    bySegmentRegion.set(seg, regionMap);
    regionsSet.add(region);

    const totals = segmentTotals.get(seg) ?? { market: 0, volvo: 0 };
    totals.market += 1;
    if ((row as { make_name: string }).make_name === FOCUS_MAKE) totals.volvo += 1;
    segmentTotals.set(seg, totals);
  }

  const segments = [...pabyggSegments];
  const regions = [...regionsSet].sort((a, b) => a - b);

  const segmentForecastMarketBySeg: Record<string, number> = {};
  const segmentForecastVolvoBySeg: Record<string, number> = {};
  for (const seg of nextYear.segments) {
    segmentForecastMarketBySeg[String(seg.pabygg)] = seg.annualMarket;
    segmentForecastVolvoBySeg[String(seg.pabygg)] = seg.annualVolvo;
  }

  const resultRows: TmfRegionSegmentForecastRow[] = regions.map((region) => {
    const cells: Record<string, TmfRegionSegmentCell> = {};

    for (const seg of segments) {
      const segKey = String(seg);
      const regionMap = bySegmentRegion.get(segKey);
      const bucket = regionMap?.get(region) ?? { market: 0, volvo: 0 };

      const totals = segmentTotals.get(segKey) ?? { market: 0, volvo: 0 };
      const segmentMarketTrailing = totals.market;
      const segmentVolvoTrailing = totals.volvo;

      const marketShare = segmentMarketTrailing > 0 ? bucket.market / segmentMarketTrailing : 0;
      const volvoShare = segmentVolvoTrailing > 0 ? bucket.volvo / segmentVolvoTrailing : 0;

      const segmentForecastMarket = segmentForecastMarketBySeg[segKey] ?? 0;
      const segmentForecastVolvo = segmentForecastVolvoBySeg[segKey] ?? 0;

      cells[segKey] = {
        region,
        market: segmentForecastMarket * marketShare,
        volvo: segmentForecastVolvo * volvoShare,
      };
    }

    return {
      region,
      label: getRegionLabel(region),
      cells,
    };
  });

  return { regions: resultRows, segments };
}

