import { formatNumber, formatPercent } from "@/lib/format";
import { TMF_DRIVER_LABELS } from "@/lib/ssb/indicators";
import type { TmfEstimateResult } from "@/lib/tmf/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfNextYearPanelProps {
  estimate: TmfEstimateResult;
}

export function TmfNextYearPanel({ estimate }: TmfNextYearPanelProps) {
  const { nextYear, scenarioLabel, driverIndices } = estimate;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Estimat {nextYear.year}</h2>
        <p className="text-muted-foreground text-sm">
          Prognose for neste år basert på OFV-baseline, sesong og SSB-drivere (
          {scenarioLabel.toLowerCase()}).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-volvo-blue/30">
          <CardHeader className="pb-2">
            <CardDescription>Totalt marked {nextYear.year}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(Math.round(nextYear.total.annualMarket))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Alle merker, N3 ≥16 tonn, sesongjustert
            </p>
          </CardContent>
        </Card>

        <Card className="border-volvo-yellow/50">
          <CardHeader className="pb-2">
            <CardDescription>Volvo-estimat {nextYear.year}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(Math.round(nextYear.total.annualVolvo))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              TMF × rullerende markedsandel (
              {formatPercent(nextYear.total.volvoSharePct, 1)} %)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vs. inneværende år (justert)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatPercent(
                estimate.currentYear.total.annualAdjustedForecast > 0
                  ? ((nextYear.total.annualMarket -
                      estimate.currentYear.total.annualAdjustedForecast) /
                      estimate.currentYear.total.annualAdjustedForecast) *
                      100
                  : 0,
                1,
              )}{" "}
              %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Markedsendring fra {estimate.currentYear.year} til {nextYear.year}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segmentestimat {nextYear.year}</CardTitle>
          <CardDescription>
            Marked og Volvo-estimat per påbygg-segment
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Segment</th>
                <th className="pb-3 pr-4 font-medium">Driver</th>
                <th className="pb-3 pr-4 text-right font-medium">Driverfaktor</th>
                <th className="pb-3 pr-4 text-right font-medium">Analytiker</th>
                <th className="pb-3 pr-4 text-right font-medium">Marked</th>
                <th className="pb-3 pr-4 text-right font-medium">Volvo-andel</th>
                <th className="pb-3 text-right font-medium">Volvo-estimat</th>
              </tr>
            </thead>
            <tbody>
              {nextYear.segments.map((segment) => (
                <tr key={segment.pabygg} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{segment.label}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {TMF_DRIVER_LABELS[segment.tmfDriver]}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    ×{segment.driverMultiplier.toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {segment.analystAdjustmentPct
                      ? `${segment.analystAdjustmentPct > 0 ? "+" : ""}${segment.analystAdjustmentPct} %`
                      : "–"}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(segment.annualMarket))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatPercent(segment.volvoSharePct, 1)} %
                    {segment.volvoShareOverridden ? " *" : ""}
                  </td>
                  <td className="py-3 text-right font-medium tabular-nums">
                    {formatNumber(Math.round(segment.annualVolvo))}
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="pt-3 pr-4">Totalt</td>
                <td className="pt-3 pr-4" />
                <td className="pt-3 pr-4" />
                <td className="pt-3 pr-4" />
                <td className="pt-3 pr-4 text-right tabular-nums">
                  {formatNumber(Math.round(nextYear.total.annualMarket))}
                </td>
                <td className="pt-3 pr-4 text-right tabular-nums">
                  {formatPercent(nextYear.total.volvoSharePct, 1)} %
                </td>
                <td className="pt-3 text-right tabular-nums">
                  {formatNumber(Math.round(nextYear.total.annualVolvo))}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SSB-driverindeks</CardTitle>
          <CardDescription>
            Gjennomsnittlig YoY-endring fra SSB, nedtonet 50 % og begrenset til ±15 %
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(driverIndices).map(([driver, info]) => (
            <div key={driver} className="rounded-lg border border-border/60 p-3">
              <p className="font-medium text-sm">
                {TMF_DRIVER_LABELS[driver as keyof typeof TMF_DRIVER_LABELS]}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                ×{info.index.toFixed(2)}
              </p>
              <p className="text-muted-foreground text-xs">
                SSB YoY:{" "}
                {info.avgChangePct == null
                  ? "–"
                  : `${info.avgChangePct > 0 ? "+" : ""}${formatPercent(info.avgChangePct, 1)} %`}
                {info.indicatorCount > 0 && ` (${info.indicatorCount} indik.)`}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
