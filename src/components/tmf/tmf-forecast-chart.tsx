"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/format";
import type { TmfMonthlyPoint } from "@/lib/tmf/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfForecastChartProps {
  year: number;
  monthly: TmfMonthlyPoint[];
  /** Faktiske registreringer per måned for året før (Jan–Des). */
  priorYearMonthlyActual?: (number | null)[];
  showAdjusted?: boolean;
}

interface ChartDatum {
  label: string;
  actual: number | null;
  priorYear: number | null;
  forecast: number;
  adjustedForecast: number;
}

function ForecastTooltip({
  active,
  payload,
  showAdjusted,
  priorYearLabel,
}: {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
  showAdjusted?: boolean;
  priorYearLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{datum.label}</p>
      {datum.actual != null && (
        <p className="text-muted-foreground">
          Faktisk:{" "}
          <span className="font-medium text-foreground">{formatNumber(datum.actual)}</span>
        </p>
      )}
      {datum.priorYear != null && (
        <p className="text-muted-foreground">
          {priorYearLabel}:{" "}
          <span className="font-medium text-foreground">
            {formatNumber(datum.priorYear)}
          </span>
        </p>
      )}
      <p className="text-muted-foreground">
        Baseline:{" "}
        <span className="font-medium text-foreground">
          {formatNumber(Math.round(datum.forecast))}
        </span>
      </p>
      {showAdjusted && (
        <p className="text-muted-foreground">
          Justert:{" "}
          <span className="font-medium text-foreground">
            {formatNumber(Math.round(datum.adjustedForecast))}
          </span>
        </p>
      )}
    </div>
  );
}

export function TmfForecastChart({
  year,
  monthly,
  priorYearMonthlyActual,
  showAdjusted = true,
}: TmfForecastChartProps) {
  const priorYearLabel = String(year - 1);
  const hasPriorYear = Boolean(
    priorYearMonthlyActual?.some((value) => value != null),
  );

  const chartData: ChartDatum[] = monthly.map((point, index) => ({
    label: point.monthLabel,
    actual: point.actual,
    priorYear: priorYearMonthlyActual?.[index] ?? null,
    forecast: point.forecast,
    adjustedForecast: point.adjustedForecast,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Totalt marked per måned</CardTitle>
        <CardDescription>
          Faktisk{hasPriorYear ? `, ${priorYearLabel}` : ""}, baseline og justert prognose
          for {year}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} width={40} />
            <Tooltip
              content={
                <ForecastTooltip
                  showAdjusted={showAdjusted}
                  priorYearLabel={priorYearLabel}
                />
              }
            />
            <Legend />
            <Bar
              dataKey="actual"
              name="Faktisk"
              fill="var(--color-volvo-blue, #003087)"
              radius={[4, 4, 0, 0]}
            />
            {hasPriorYear ? (
              <Line
                type="monotone"
                dataKey="priorYear"
                name={priorYearLabel}
                stroke="#64748b"
                strokeWidth={2}
                strokeDasharray="2 4"
                dot={false}
                connectNulls
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="forecast"
              name="Baseline"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
            {showAdjusted && (
              <Line
                type="monotone"
                dataKey="adjustedForecast"
                name="Justert prognose"
                stroke="#FFCC00"
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
