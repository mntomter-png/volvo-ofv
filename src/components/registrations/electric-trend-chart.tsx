"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPercent } from "@/lib/format";
import type { ElectricSegmentTrendPoint } from "@/lib/registrations/queries";

const LINE_COLORS = [
  "oklch(0.36 0.16 264)",
  "oklch(0.87 0.17 95)",
  "oklch(0.55 0.12 230)",
  "oklch(0.58 0.22 27)",
  "oklch(0.65 0.14 200)",
];

const TICK_FILL = "var(--muted-foreground)";
const Y_AXIS_WIDTH = 40;

interface ElectricTrendChartProps {
  series: ElectricSegmentTrendPoint[];
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="mb-1 font-medium">{label}</p>
      <ul className="space-y-1">
        {payload.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="tabular-nums">{formatPercent(item.value)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function shortMonth(label: string): string {
  const space = label.lastIndexOf(" ");
  return space > 0 ? label.slice(0, space) : label;
}

export function ElectricTrendChart({ series }: ElectricTrendChartProps) {
  if (series.length === 0 || series[0]?.points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen elektrifiseringsdata i utvalget.
      </p>
    );
  }

  const monthLabels = series[0]!.points.map((point) => point.label);
  const chartData = monthLabels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    for (const item of series) {
      row[item.segment] = item.points[index]?.share ?? 0;
    }
    return row;
  });

  return (
    <div className="w-full min-w-0">
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              type="category"
              tick={false}
              axisLine={false}
              tickLine={false}
              height={0}
            />
            <YAxis
              tick={{ fontSize: 12, fill: TICK_FILL }}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_WIDTH}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<TrendTooltip />} />
            {series.map((item, index) => (
              <Line
                key={item.segment}
                type="monotone"
                dataKey={item.segment}
                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-1 flex text-[11px] text-muted-foreground"
        style={{ paddingLeft: Y_AXIS_WIDTH, paddingRight: 12 }}
      >
        {monthLabels.map((label) => (
          <div key={label} className="min-w-0 flex-1 truncate text-center">
            {shortMonth(label)}
          </div>
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((item, index) => (
          <li key={item.segment} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: LINE_COLORS[index % LINE_COLORS.length],
              }}
            />
            {item.segment}
          </li>
        ))}
      </ul>
    </div>
  );
}
