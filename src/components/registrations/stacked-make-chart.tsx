"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useBrand } from "@/components/brand/brand-provider";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  stackedMakeKeys,
  type StackedMakeRow,
} from "@/lib/registrations/analytics";

const FALLBACK_COLORS = [
  "oklch(0.55 0.12 230)",
  "oklch(0.5 0.02 260)",
  "oklch(0.65 0.14 200)",
  "oklch(0.45 0.1 264)",
  "oklch(0.7 0.12 250)",
  "oklch(0.58 0.22 27)",
  "oklch(0.62 0.08 240)",
];

interface StackedMakeChartProps {
  data: StackedMakeRow[];
  /**
   * `horizontal` = stolper oppover (tid på X, f.eks. måneder).
   * `vertical` = stolper sidelengs (kategori på Y).
   */
  layout?: "vertical" | "horizontal";
  emptyMessage?: string;
}

function StackedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, item) => sum + (item.value ?? 0), 0);

  return (
    <div className="max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="mb-1 font-medium">{label}</p>
      <p className="mb-2 text-muted-foreground">
        {formatNumber(total)} registreringer
      </p>
      <ul className="space-y-1">
        {payload
          .filter((item) => item.value > 0)
          .map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(item.value)} ·{" "}
                {formatPercent(total > 0 ? (item.value / total) * 100 : 0)} %
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** «jan 2026» → «jan» når alle punkter er samme år. */
function shortMonthTick(label: string, allSameYear: boolean): string {
  if (!allSameYear) return label;
  const space = label.lastIndexOf(" ");
  return space > 0 ? label.slice(0, space) : label;
}

export function StackedMakeChart({
  data,
  layout = "vertical",
  emptyMessage = "Ingen data i utvalget.",
}: StackedMakeChartProps) {
  const brand = useBrand();

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const makeKeys = stackedMakeKeys(data);
  const chartData = data.map((row) => ({ label: row.label, ...row.segments }));

  const years = new Set(
    data.map((row) => {
      const parts = row.label.trim().split(/\s+/);
      return parts[parts.length - 1] ?? "";
    }),
  );
  const allSameYear = years.size === 1;

  function colorForMake(make: string, index: number): string {
    if (make === brand.makeName) return brand.chartAccent;
    if (make === "Andre") return "oklch(0.72 0.02 260)";
    return FALLBACK_COLORS[index % FALLBACK_COLORS.length] ?? "oklch(0.55 0.12 230)";
  }

  // Recharts: layout="horizontal" = stolper oppover; "vertical" = stolper sidelengs.
  const barsGrowUp = layout === "horizontal";
  const height = barsGrowUp ? 340 : Math.max(280, data.length * 36);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout={barsGrowUp ? "horizontal" : "vertical"}
        margin={
          barsGrowUp
            ? { top: 12, right: 12, left: 4, bottom: 8 }
            : { top: 8, right: 20, left: 4, bottom: 8 }
        }
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        {barsGrowUp ? (
          <>
            <XAxis
              dataKey="label"
              interval={0}
              minTickGap={0}
              tick={{ fontSize: 11, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
              height={36}
              tickFormatter={(value: string) =>
                shortMonthTick(String(value), allSameYear)
              }
            />
            <YAxis
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
              width={44}
              allowDecimals={false}
            />
          </>
        ) : (
          <>
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
              width={128}
            />
          </>
        )}
        <Tooltip content={<StackedTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          iconType="square"
          iconSize={10}
        />
        {makeKeys.map((make, index) => (
          <Bar
            key={make}
            dataKey={make}
            stackId="makes"
            fill={colorForMake(make, index)}
            radius={
              index === makeKeys.length - 1
                ? barsGrowUp
                  ? [3, 3, 0, 0]
                  : [0, 3, 3, 0]
                : undefined
            }
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
