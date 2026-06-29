"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MakeShare } from "@/lib/dashboard/queries";

const COLORS = [
  "oklch(0.36 0.16 264)",
  "oklch(0.87 0.17 95)",
  "oklch(0.55 0.12 230)",
  "oklch(0.5 0.02 260)",
  "oklch(0.65 0.14 200)",
  "oklch(0.45 0.1 264)",
  "oklch(0.7 0.12 250)",
  "oklch(0.58 0.22 27)",
];

interface MakeShareChartProps {
  data: MakeShare[];
  highlightMake?: string;
}

export function MakeShareChart({ data, highlightMake = "Volvo" }: MakeShareChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ingen merkedata ennå.</p>
    );
  }

  const chartData = data.map((row) => ({
    name: row.make_name,
    count: row.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          formatter={(value: number) => [value, "Antall"]}
          contentStyle={{
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
            background: "var(--card)",
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={
                entry.name === highlightMake
                  ? COLORS[1]
                  : COLORS[index % COLORS.length]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
