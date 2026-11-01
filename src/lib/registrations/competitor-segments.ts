import { formatPercent } from "@/lib/format";
import {
  ALL_PABYGG_SEGMENTS,
  getPabyggSegmentLabel,
  type PabyggSegment,
} from "@/lib/ofv/segmentation";

/**
 * Konkurrentbilde per påbygg-segment for Marked-fanen.
 *
 * Tallene kommer ferdig aggregert fra `reg_make_share_by_pabygg` (denne
 * perioden og samme periode i fjor). Her regnes andel, prosentpoeng og
 * plassering. Endring som rundes til 0,0 pp regnes som stabil, så uthevingen
 * matcher tallet som vises.
 */

export interface MakeSegmentCount {
  pabygg: string;
  make_name: string;
  count: number;
}

export interface CompetitorMakeRow {
  make: string;
  count: number;
  previousCount: number;
  sharePct: number;
  /** Null når segmentet ikke hadde registreringer i fjor. */
  previousSharePct: number | null;
  /** Null når fjoråret mangler. Ellers andel nå minus andel i fjor, i prosentpoeng. */
  sharePointDelta: number | null;
  isFocus: boolean;
}

export interface CompetitorSegment {
  pabygg: string;
  label: string;
  total: number;
  previousTotal: number;
  focusCount: number;
  focusSharePct: number;
  focusPreviousSharePct: number | null;
  focusSharePointDelta: number | null;
  /** 1 = flest registreringer. Null når fokusmerket har 0 i perioden. */
  focusRank: number | null;
  focusTied: boolean;
  makes: CompetitorMakeRow[];
}

export type ShareMove = "gain" | "loss" | "flat" | "none";

export interface FocusShareHeadline {
  text: string;
  tone: "gain" | "loss" | "mixed" | "flat";
}

const SEGMENT_ORDER = new Map<string, number>(
  ALL_PABYGG_SEGMENTS.map((segment, index) => [segment, index]),
);

function asCount(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function tally(rows: MakeSegmentCount[]): Map<string, Map<string, number>> {
  const bySegment = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const count = asCount(row.count);
    if (!row.pabygg || !row.make_name || count == null) continue;
    let makes = bySegment.get(row.pabygg);
    if (!makes) {
      makes = new Map();
      bySegment.set(row.pabygg, makes);
    }
    makes.set(row.make_name, (makes.get(row.make_name) ?? 0) + count);
  }
  return bySegment;
}

function sharePct(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}

/** Avrunder til én desimal, vekk fra null, så −0,05 pp ikke blir 0. */
export function roundSharePoints(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 10)) / 10;
}

export function shareMove(delta: number | null): ShareMove {
  if (delta == null || !Number.isFinite(delta)) return "none";
  const rounded = roundSharePoints(delta);
  if (rounded > 0) return "gain";
  if (rounded < 0) return "loss";
  return "flat";
}

export function formatSharePoints(delta: number | null): string {
  if (delta == null || !Number.isFinite(delta)) return "—";
  const rounded = roundSharePoints(delta);
  if (rounded === 0) return `${formatPercent(0, 1)} pp`;
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${formatPercent(Math.abs(rounded), 1)} pp`;
}

export function focusPositionLabel(rank: number | null, tied: boolean): string {
  if (rank == null) return "Ikke registrert";
  const place = `${rank}. plass`;
  return tied ? `delt ${place}` : place;
}

function joinNb(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} og ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} og ${items[items.length - 1]}`;
}

function segmentSortKey(pabygg: string): number {
  return SEGMENT_ORDER.get(pabygg as PabyggSegment) ?? SEGMENT_ORDER.size;
}

export function buildCompetitorSegments(
  current: MakeSegmentCount[],
  previous: MakeSegmentCount[],
  focusMake: string,
): CompetitorSegment[] {
  const currentBySegment = tally(current);
  const previousBySegment = tally(previous);
  const segmentKeys = new Set([
    ...currentBySegment.keys(),
    ...previousBySegment.keys(),
  ]);

  const segments: CompetitorSegment[] = [];

  for (const pabygg of segmentKeys) {
    const currentMakes = currentBySegment.get(pabygg) ?? new Map<string, number>();
    const previousMakes = previousBySegment.get(pabygg) ?? new Map<string, number>();
    const total = [...currentMakes.values()].reduce((sum, count) => sum + count, 0);
    const previousTotal = [...previousMakes.values()].reduce(
      (sum, count) => sum + count,
      0,
    );
    if (total === 0 && previousTotal === 0) continue;

    const makeNames = new Set([...currentMakes.keys(), ...previousMakes.keys()]);
    if (focusMake) makeNames.add(focusMake);

    const makes: CompetitorMakeRow[] = [...makeNames].map((make) => {
      const count = currentMakes.get(make) ?? 0;
      const previousCount = previousMakes.get(make) ?? 0;
      const currentShare = sharePct(count, total);
      const previousShare =
        previousTotal > 0 ? sharePct(previousCount, previousTotal) : null;
      return {
        make,
        count,
        previousCount,
        sharePct: currentShare,
        previousSharePct: previousShare,
        sharePointDelta:
          previousShare == null ? null : currentShare - previousShare,
        isFocus: make === focusMake,
      };
    });

    makes.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.previousCount !== a.previousCount) return b.previousCount - a.previousCount;
      return a.make.localeCompare(b.make, "nb");
    });

    const ranked = makes.filter((row) => row.count > 0);
    const focus = makes.find((row) => row.isFocus);
    const focusCount = focus?.count ?? 0;
    let focusRank: number | null = null;
    let focusTied = false;
    if (focusCount > 0) {
      focusRank = ranked.filter((row) => row.count > focusCount).length + 1;
      focusTied = ranked.filter((row) => row.count === focusCount).length > 1;
    }

    segments.push({
      pabygg,
      label: getPabyggSegmentLabel(pabygg),
      total,
      previousTotal,
      focusCount,
      focusSharePct: focus?.sharePct ?? 0,
      focusPreviousSharePct: focus?.previousSharePct ?? null,
      focusSharePointDelta: focus?.sharePointDelta ?? null,
      focusRank,
      focusTied,
      makes,
    });
  }

  segments.sort((a, b) => {
    const order = segmentSortKey(a.pabygg) - segmentSortKey(b.pabygg);
    if (order !== 0) return order;
    return a.label.localeCompare(b.label, "nb");
  });

  return segments;
}

export function focusShareHeadline(
  segments: CompetitorSegment[],
  focusName: string,
): FocusShareHeadline | null {
  const comparable = segments.filter(
    (segment) => shareMove(segment.focusSharePointDelta) !== "none",
  );
  if (comparable.length === 0) return null;

  const gains = comparable.filter(
    (segment) => shareMove(segment.focusSharePointDelta) === "gain",
  );
  const losses = comparable.filter(
    (segment) => shareMove(segment.focusSharePointDelta) === "loss",
  );

  if (gains.length === 0 && losses.length === 0) {
    return {
      text: `${focusName}-andelen er stabil mot samme periode i fjor.`,
      tone: "flat",
    };
  }

  const gainText = gains.map(
    (segment) => `${segment.label} (${formatSharePoints(segment.focusSharePointDelta)})`,
  );
  const lossText = losses.map(
    (segment) => `${segment.label} (${formatSharePoints(segment.focusSharePointDelta)})`,
  );

  if (gains.length > 0 && losses.length > 0) {
    return {
      text: `${focusName} tar andel i ${joinNb(gainText)}. Taper i ${joinNb(lossText)}.`,
      tone: "mixed",
    };
  }

  if (gains.length > 0) {
    return {
      text: `${focusName} tar andel i ${joinNb(gainText)}.`,
      tone: "gain",
    };
  }

  return {
    text: `${focusName} taper andel i ${joinNb(lossText)}.`,
    tone: "loss",
  };
}
