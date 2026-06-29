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

import { formatNumber, formatPercent } from "@/lib/format";
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
  /**
   * Reell total å regne andel mot (f.eks. alle merker, ikke bare topp 10).
   * Faller tilbake til summen av viste merker hvis utelatt.
   */
  total?: number;
}

interface ChartDatum {
  name: string;
  count: number;
  share: number;
}

function ShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{datum.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(datum.count)} stk ·{" "}
        <span className="font-medium text-foreground">
          {formatPercent(datum.share)} %
        </span>
      </p>
    </div>
  );
}

export function MakeShareChart({
  data,
  highlightMake = "Volvo",
  total,
}: MakeShareChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ingen merkedata ennå.</p>
    );
  }

  const denominator =
    total && total > 0 ? total : data.reduce((sum, row) => sum + row.count, 0);

  const chartData: ChartDatum[] = data.map((row) => ({
    name: row.make_name,
    count: row.count,
    share: denominator > 0 ? (row.count / denominator) * 100 : 0,
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
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={<ShareTooltip />}
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
