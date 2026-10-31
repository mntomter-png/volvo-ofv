import assert from "node:assert/strict";

import type { TmfMonthlyMarketRow } from "@/lib/tmf/types";

export function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function marketRow(
  year: number,
  month: number,
  pabygg: string,
  count: number,
  volvoShare = 0.4,
  emobShare = 0.1,
): TmfMonthlyMarketRow {
  return {
    month: monthStart(year, month),
    pabygg,
    count,
    volvo_count: count * volvoShare,
    emob_count: count * emobShare,
  };
}

export function fillSegment(
  years: number[],
  pabygg: string,
  countFor: (year: number, month: number) => number,
  volvoShare = 0.4,
  emobShare = 0.1,
): TmfMonthlyMarketRow[] {
  const rows: TmfMonthlyMarketRow[] = [];
  for (const year of years) {
    for (let month = 1; month <= 12; month += 1) {
      rows.push(
        marketRow(year, month, pabygg, countFor(year, month), volvoShare, emobShare),
      );
    }
  }
  return rows;
}

export function closeTo(actual: number, expected: number, epsilon = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${expected} ± ${epsilon}, got ${actual}`,
  );
}

export const EMPTY_INPUT = {
  scenarioId: "basis" as const,
  segmentAdjustments: {},
  volvoShareOverrides: {},
};
