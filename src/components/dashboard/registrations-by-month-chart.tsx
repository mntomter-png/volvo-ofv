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

import type { MonthlyRegistration } from "@/lib/dashboard/queries";

const VOLVO_BLUE = "oklch(0.36 0.16 264)";
const VOLVO_YELLOW = "oklch(0.87 0.17 95)";

interface RegistrationsByMonthChartProps {
  data: MonthlyRegistration[];
}

export function RegistrationsByMonthChart({
  data,
}: RegistrationsByMonthChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ingen registreringsdata ennå.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          formatter={(value: number) => [value, "Registreringer"]}
          labelFormatter={(label) => label}
          contentStyle={{
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
            background: "var(--card)",
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={index === data.length - 1 ? VOLVO_YELLOW : VOLVO_BLUE}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
