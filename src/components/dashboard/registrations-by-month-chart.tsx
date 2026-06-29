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
  /** Aktiv måned (1-12) som streng, for nedboring. */
  activeMonthKey?: string | null;
  /** Kalles når en stolpe klikkes (måned 1-12 som streng). */
  onSelectMonth?: (monthKey: string) => void;
}

interface ChartDatum {
  label: string;
  count: number;
  share: number;
  monthKey: string;
}

const VOLVO_BLUE_DIM = "oklch(0.36 0.16 264 / 0.35)";

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
  activeMonthKey = null,
  onSelectMonth,
}: RegistrationsByMonthChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ingen registreringsdata ennå.</p>
    );
  }

  const total = data.reduce((sum, row) => sum + row.count, 0);
  const selectable = typeof onSelectMonth === "function";

  const chartData: ChartDatum[] = data.map((row) => ({
    label: row.label,
    count: row.count,
    share: total > 0 ? (row.count / total) * 100 : 0,
    monthKey: String(Number.parseInt(row.month.slice(5, 7), 10)),
  }));

  function cellFill(datum: ChartDatum, isLast: boolean): string {
    const base = isLast ? VOLVO_YELLOW : VOLVO_BLUE;
    if (!activeMonthKey) return base;
    return datum.monthKey === activeMonthKey ? base : VOLVO_BLUE_DIM;
  }

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
        <Bar
          dataKey="count"
          radius={[4, 4, 0, 0]}
          cursor={selectable ? "pointer" : undefined}
          onClick={
            selectable
              ? (entry: { payload?: ChartDatum }) => {
                  if (entry?.payload) onSelectMonth!(entry.payload.monthKey);
                }
              : undefined
          }
        >
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={cellFill(entry, index === chartData.length - 1)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
