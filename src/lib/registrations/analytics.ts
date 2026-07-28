/** Maks antall merker som vises eksplisitt før resten slås sammen som «Andre». */
export const TOP_MAKES_LIMIT = 5;

/** Maks antall påbygg-rader i konkurranse-diagrammet. */
export const TOP_PABYGG_LIMIT = 8;

export interface MakeCountRow {
  make_name: string;
  count: number;
}

export interface StackedMakeRow {
  label: string;
  total: number;
  segments: Record<string, number>;
}

const OTHER_LABEL = "Andre";

/** Velger topp N merker globalt og bygger stablede rader per gruppe. */
export function buildStackedMakeRows(
  rows: { groupKey: string; groupLabel: string; make_name: string; count: number }[],
  options?: { topGroups?: number; topMakes?: number },
): StackedMakeRow[] {
  const topGroups = options?.topGroups ?? TOP_PABYGG_LIMIT;
  const topMakes = options?.topMakes ?? TOP_MAKES_LIMIT;

  const groupTotals = new Map<string, { label: string; total: number }>();
  const makeTotals = new Map<string, number>();

  for (const row of rows) {
    const group = groupTotals.get(row.groupKey) ?? {
      label: row.groupLabel,
      total: 0,
    };
    group.total += row.count;
    groupTotals.set(row.groupKey, group);
    makeTotals.set(row.make_name, (makeTotals.get(row.make_name) ?? 0) + row.count);
  }

  const topMakeNames = [...makeTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topMakes)
    .map(([name]) => name);

  const topGroupKeys = [...groupTotals.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, topGroups)
    .map(([key]) => key);

  return topGroupKeys.map((groupKey) => {
    const groupRows = rows.filter((row) => row.groupKey === groupKey);
    const segments: Record<string, number> = {};
    let other = 0;

    for (const row of groupRows) {
      if (topMakeNames.includes(row.make_name)) {
        segments[row.make_name] = (segments[row.make_name] ?? 0) + row.count;
      } else {
        other += row.count;
      }
    }

    if (other > 0) {
      segments[OTHER_LABEL] = other;
    }

    const group = groupTotals.get(groupKey)!;
    return { label: group.label, total: group.total, segments };
  });
}

export function stackedMakeKeys(rows: StackedMakeRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.segments)) {
      keys.add(key);
    }
  }

  const ordered = [...keys].filter((key) => key !== OTHER_LABEL).sort();
  if (keys.has(OTHER_LABEL)) ordered.push(OTHER_LABEL);
  return ordered;
}

export interface ElectricTrendPoint {
  label: string;
  share: number;
}

export interface ElectricSegmentTrendSeries {
  segment: string;
  points: ElectricTrendPoint[];
}

/** Bygger månedlig elektrifiseringsandel for de største Volvo påbygg-segmentene. */
export function buildElectricSegmentTrend(
  rows: {
    month: string;
    segment: string;
    total_count: number;
    electric_count: number;
  }[],
  options?: { topSegments?: number; formatMonth?: (iso: string) => string },
): ElectricSegmentTrendSeries[] {
  const topSegments = options?.topSegments ?? 5;
  const formatMonth =
    options?.formatMonth ??
    ((iso: string) => {
      const month = Number.parseInt(iso.slice(5, 7), 10);
      const labels = [
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
      ];
      return `${labels[month - 1] ?? iso} ${iso.slice(0, 4)}`;
    });

  const segmentTotals = new Map<string, number>();
  const monthSet = new Set<string>();

  for (const row of rows) {
    segmentTotals.set(
      row.segment,
      (segmentTotals.get(row.segment) ?? 0) + row.total_count,
    );
    monthSet.add(row.month);
  }

  const months = [...monthSet].sort();
  const topSegmentNames = [...segmentTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topSegments)
    .map(([segment]) => segment);

  const rowMap = new Map<string, { total: number; electric: number }>();
  for (const row of rows) {
    rowMap.set(`${row.month}|${row.segment}`, {
      total: row.total_count,
      electric: row.electric_count,
    });
  }

  return topSegmentNames.map((segment) => ({
    segment,
    points: months.map((month) => {
      const values = rowMap.get(`${month}|${segment}`);
      const share =
        values && values.total > 0
          ? (values.electric / values.total) * 100
          : 0;
      return { label: formatMonth(month), share };
    }),
  }));
}
