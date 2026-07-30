import { findSsbIndicatorSource, TMF_DRIVER_LABELS } from "@/lib/ssb/indicators";
import type { TmfDriver } from "@/lib/ssb/types";
import { createClient } from "@/lib/supabase/server";

export interface SsbIndicatorPoint {
  indicator_key: string;
  label: string;
  period: string;
  value: number;
  unit: string | null;
  tmf_driver: TmfDriver;
  ssb_table_id: string;
  synced_at: string;
}

export interface SsbDriverGroup {
  driver: TmfDriver;
  label: string;
  indicators: {
    indicator_key: string;
    label: string;
    unit: string | null;
    ssb_table_id: string;
    latestPeriod: string;
    latestValue: number;
    previousValue: number | null;
    /** YoY-endring (evt. invertert for rente). */
    changePct: number | null;
    inverted: boolean;
    series: { period: string; value: number }[];
  }[];
}

export interface SsbSyncStatus {
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  indicatorCount: number;
}

const SSB_PAGE_SIZE = 1000;

/** Sorterbar nøkkel for SSB-perioder (år, kvartal, måned). */
export function compareSsbPeriods(a: string, b: string): number {
  return ssbPeriodSortKey(a) - ssbPeriodSortKey(b);
}

function ssbPeriodSortKey(period: string): number {
  const month = period.match(/^(\d{4})M(\d{2})$/);
  if (month) {
    return Number(month[1]) * 100 + Number(month[2]);
  }
  const quarter = period.match(/^(\d{4})K([1-4])$/);
  if (quarter) {
    return Number(quarter[1]) * 100 + Number(quarter[2]) * 25;
  }
  const year = Number.parseInt(period, 10);
  return Number.isFinite(year) && String(year) === period ? year * 100 : 0;
}

function previousYearPeriod(period: string): string | null {
  const month = period.match(/^(\d{4})M(\d{2})$/);
  if (month) {
    return `${Number(month[1]) - 1}M${month[2]}`;
  }
  const quarter = period.match(/^(\d{4})K([1-4])$/);
  if (quarter) {
    return `${Number(quarter[1]) - 1}K${quarter[2]}`;
  }
  const year = Number.parseInt(period, 10);
  if (Number.isFinite(year) && String(year) === period) {
    return String(year - 1);
  }
  return null;
}

function pctChange(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getSsbSyncStatus(): Promise<SsbSyncStatus> {
  const supabase = await createClient();

  const [syncRes, countRes] = await Promise.all([
    supabase
      .from("sync_logs")
      .select("completed_at, status")
      .eq("sync_type", "ssb")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ completed_at: string | null; status: string }>(),
    supabase
      .from("ssb_indicators")
      .select("id", { count: "exact", head: true }),
  ]);

  return {
    lastSyncAt: syncRes.data?.completed_at ?? null,
    lastSyncStatus: syncRes.data?.status ?? null,
    indicatorCount: countRes.count ?? 0,
  };
}

export async function getSsbIndicatorPoints(): Promise<SsbIndicatorPoint[]> {
  const supabase = await createClient();
  const all: SsbIndicatorPoint[] = [];
  let from = 0;

  for (;;) {
    const to = from + SSB_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("ssb_indicators")
      .select(
        "indicator_key, label, period, value, unit, tmf_driver, ssb_table_id, synced_at",
      )
      .order("period", { ascending: true })
      .range(from, to);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as SsbIndicatorPoint[];
    all.push(...rows);
    if (rows.length < SSB_PAGE_SIZE) break;
    from += SSB_PAGE_SIZE;
  }

  return all;
}

export async function getSsbDriverGroups(): Promise<SsbDriverGroup[]> {
  const points = await getSsbIndicatorPoints();
  const byDriver = new Map<TmfDriver, SsbDriverGroup>();

  for (const driver of Object.keys(TMF_DRIVER_LABELS) as TmfDriver[]) {
    byDriver.set(driver, {
      driver,
      label: TMF_DRIVER_LABELS[driver],
      indicators: [],
    });
  }

  const byKey = new Map<string, SsbIndicatorPoint[]>();
  for (const point of points) {
    const list = byKey.get(point.indicator_key) ?? [];
    list.push(point);
    byKey.set(point.indicator_key, list);
  }

  for (const [indicatorKey, series] of byKey) {
    const sorted = [...series].sort((a, b) => compareSsbPeriods(a.period, b.period));
    const latest = sorted.at(-1);
    if (!latest) continue;

    const yoyPeriod = previousYearPeriod(latest.period);
    const previous =
      (yoyPeriod
        ? sorted.find((point) => point.period === yoyPeriod)
        : null) ?? null;

    const source = findSsbIndicatorSource(indicatorKey);
    const inverted = source?.invertSignal === true;
    let changePct = pctChange(latest.value, previous?.value ?? null);
    if (changePct != null && inverted) {
      changePct = -changePct;
    }

    const group = byDriver.get(latest.tmf_driver);
    if (!group) continue;

    group.indicators.push({
      indicator_key: indicatorKey,
      label: latest.label,
      unit: latest.unit,
      ssb_table_id: latest.ssb_table_id,
      latestPeriod: latest.period,
      latestValue: latest.value,
      previousValue: previous?.value ?? null,
      changePct,
      inverted,
      series: sorted.map((row) => ({ period: row.period, value: row.value })),
    });
  }

  const driverOrder: TmfDriver[] = [
    "construction",
    "distribution",
    "long_haul",
    "macro",
  ];

  return driverOrder
    .map((driver) => byDriver.get(driver))
    .filter((group): group is SsbDriverGroup => group != null && group.indicators.length > 0);
}

export function formatSsbPeriod(period: string): string {
  const month = period.match(/^(\d{4})M(\d{2})$/);
  if (month) {
    return `${Number(month[2])}.${month[1]}`;
  }
  const quarter = period.match(/^(\d{4})K([1-4])$/);
  if (quarter) return `K${quarter[2]} ${quarter[1]}`;
  return period;
}

export function formatSsbValue(value: number, unit: string | null): string {
  const formatted = new Intl.NumberFormat("nb-NO", {
    maximumFractionDigits: value >= 1000 ? 0 : 1,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatChangePct(changePct: number | null): string {
  if (changePct == null) return "–";
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(1)} %`;
}
