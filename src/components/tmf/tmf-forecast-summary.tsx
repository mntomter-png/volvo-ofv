import { formatNumber, formatPercent } from "@/lib/format";
import type { TmfForecastResult } from "@/lib/tmf/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfForecastSummaryProps {
  forecast: TmfForecastResult;
}

function variancePct(actual: number, expected: number): number | null {
  if (expected === 0) return null;
  return ((actual - expected) / expected) * 100;
}

export function TmfForecastSummary({ forecast }: TmfForecastSummaryProps) {
  const { total, year, scenarioLabel } = forecast;
  const ytdVariance = variancePct(total.ytdActual, total.ytdAdjustedForecast);
  const remainingForecast = total.annualAdjustedForecast - total.ytdAdjustedForecast;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>YTD faktisk {year}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {formatNumber(total.ytdActual)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">
            Nyregistrerte tunge lastebiler (alle merker)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>YTD justert prognose</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {formatNumber(Math.round(total.ytdAdjustedForecast))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">
            Avvik:{" "}
            {ytdVariance == null ? (
              "–"
            ) : (
              <span
                className={
                  ytdVariance > 0
                    ? "font-medium text-emerald-600"
                    : ytdVariance < 0
                      ? "font-medium text-red-600"
                      : "font-medium"
                }
              >
                {ytdVariance > 0 ? "+" : ""}
                {formatPercent(ytdVariance)} %
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Årsprognose {year} ({scenarioLabel})</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {formatNumber(Math.round(total.annualAdjustedForecast))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">
            Baseline {formatNumber(Math.round(total.annualForecast))} + SSB/scenario
          </p>
          <p className="text-muted-foreground text-xs">
            EMOB {formatNumber(Math.round(total.annualEmob))} · diesel{" "}
            {formatNumber(Math.round(total.annualDiesel))} · gass{" "}
            {formatNumber(Math.round(total.annualGas))}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Resten av {year}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {formatNumber(Math.round(remainingForecast))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">
            Sesongkalibrert mot{" "}
            {forecast.seasonalityYears[0]}–{forecast.seasonalityYears.at(-1)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
