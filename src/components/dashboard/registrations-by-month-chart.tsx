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

import { useBrand } from "@/components/brand/brand-provider";
import { formatNumber, formatPercent } from "@/lib/format";
import type { MonthlyRegistration } from "@/lib/dashboard/queries";

interface RegistrationsByMonthChartProps {
  data: MonthlyRegistration[];
  activeMonthKey?: string | null;
  onSelectMonth?: (monthKey: string) => void;
}

interface ChartDatum {
  label: string;
  count: number;
  focusShare: number;
  monthKey: string;
}

function MonthTooltip({
  active,
  payload,
  focusLabel,
}: {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
  focusLabel: string;
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
          {formatPercent(datum.focusShare)} %
        </span>{" "}
        {focusLabel}
      </p>
    </div>
  );
}

export function RegistrationsByMonthChart({
  data,
  activeMonthKey = null,
  onSelectMonth,
}: RegistrationsByMonthChartProps) {
  const brand = useBrand();

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ingen registreringsdata ennå.</p>
    );
  }

  const selectable = typeof onSelectMonth === "function";

  const chartData: ChartDatum[] = data.map((row) => ({
    label: row.label,
    count: row.count,
    focusShare: row.count > 0 ? (row.volvo_count / row.count) * 100 : 0,
    monthKey: String(Number.parseInt(row.month.slice(5, 7), 10)),
  }));

  function cellFill(datum: ChartDatum, isLast: boolean): string {
    const base = isLast ? brand.chartAccent : brand.chartPrimary;
    if (!activeMonthKey) return base;
    return datum.monthKey === activeMonthKey ? base : brand.chartPrimaryDim;
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
          content={<MonthTooltip focusLabel={brand.shortName} />}
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
