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
import type { MonthlyRegistration } from "@/lib/dashboard/queries";

const VOLVO_BLUE = "oklch(0.36 0.16 264)";
const VOLVO_YELLOW = "oklch(0.87 0.17 95)";

interface RegistrationsByMonthChartProps {
  data: MonthlyRegistration[];
}

interface ChartDatum {
  label: string;
  count: number;
  share: number;
}

function MonthTooltip({
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
      <p className="font-medium">{datum.label}</p>
      <p className="text-muted-foreground">
        {formatNumber(datum.count)} registreringer ·{" "}
        <span className="font-medium text-foreground">
          {formatPercent(datum.share)} %
        </span>{" "}
        av perioden
      </p>
    </div>
  );
}

export function RegistrationsByMonthChart({
  data,
}: RegistrationsByMonthChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ingen registreringsdata ennå.</p>
    );
  }

  const total = data.reduce((sum, row) => sum + row.count, 0);

  const chartData: ChartDatum[] = data.map((row) => ({
    label: row.label,
    count: row.count,
    share: total > 0 ? (row.count / total) * 100 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={<MonthTooltip />}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((_, index) => (
            <Cell
              key={index}
              fill={index === chartData.length - 1 ? VOLVO_YELLOW : VOLVO_BLUE}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
