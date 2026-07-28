"use client";

import {
  CartesianGrid,
  Legend,
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
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          interval={0}
          minTickGap={0}
          tick={{ fontSize: 11, fill: "currentColor" }}
          tickLine={false}
          axisLine={false}
          height={36}
          tickFormatter={(value: string) => {
            const text = String(value);
            const space = text.lastIndexOf(" ");
            return space > 0 ? text.slice(0, space) : text;
          }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "currentColor" }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<TrendTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
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
  );
}
