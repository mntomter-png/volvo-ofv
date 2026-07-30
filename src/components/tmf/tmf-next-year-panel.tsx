import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { formatNumber, formatPercent } from "@/lib/format";
import { TMF_DRIVER_LABELS } from "@/lib/ssb/indicators";
import { buildTmfPageSearchParams } from "@/lib/tmf/adjustments";
import type { TmfEstimateResult } from "@/lib/tmf/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TmfRegionSegmentPanel } from "@/components/tmf/tmf-region-segment-panel";

interface TmfNextYearPanelProps {
  estimate: TmfEstimateResult;
}

export function TmfNextYearPanel({ estimate }: TmfNextYearPanelProps) {
  const { nextYear, scenarioLabel, driverIndices, confidence, calibration, scenarioEnvelope } =
    estimate;
  const baseSearchParams = buildTmfPageSearchParams({
    scenario: estimate.scenario,
    segmentAdjustments: estimate.segmentAdjustments,
    volvoShareOverrides: estimate.volvoShareOverrides,
  });

  function buildDrilldownHref(pabygg: string): Route {
    const params = new URLSearchParams(baseSearchParams);
    params.set("pabygg", pabygg);
    return `/tmf?${params.toString()}` as Route;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">
          Markedspotensial {nextYear.year} (OFV-registreringer)
        </h2>
        <p className="text-muted-foreground text-sm">
          Prognose basert på OFV-baseline, trend, sesong og kalibrerte SSB-drivere (
          {scenarioLabel.toLowerCase()}).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-volvo-blue/30">
          <CardHeader className="pb-2">
            <CardDescription>Totalt marked {nextYear.year} (P50)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(Math.round(nextYear.total.annualMarket))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              P10–P90: {formatNumber(Math.round(confidence.market.p10))}–
              {formatNumber(Math.round(confidence.market.p90))}
            </p>
          </CardContent>
        </Card>

        <Card className="border-volvo-yellow/50">
          <CardHeader className="pb-2">
            <CardDescription>Volvo-estimat {nextYear.year} (P50)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(Math.round(nextYear.total.annualVolvo))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              P10–P90: {formatNumber(Math.round(confidence.volvo.p10))}–
              {formatNumber(Math.round(confidence.volvo.p90))} · andel{" "}
              {formatPercent(nextYear.total.volvoSharePct, 1)} %
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
              {nextYear.trendApplied ? " (inkl. trend)" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usikkerhetsbånd</CardTitle>
            <CardDescription>
              MAPE {formatPercent(confidence.mapeUsed, 1)} % · scenariospenn{" "}
              {formatNumber(Math.round(confidence.scenarioLow))}–
              {formatNumber(Math.round(confidence.scenarioHigh))}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Marked P10 / P50 / P90</span>
              <span className="tabular-nums font-medium">
                {formatNumber(Math.round(confidence.market.p10))} /{" "}
                {formatNumber(Math.round(confidence.market.p50))} /{" "}
                {formatNumber(Math.round(confidence.market.p90))}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Volvo P10 / P50 / P90</span>
              <span className="tabular-nums font-medium">
                {formatNumber(Math.round(confidence.volvo.p10))} /{" "}
                {formatNumber(Math.round(confidence.volvo.p50))} /{" "}
                {formatNumber(Math.round(confidence.volvo.p90))}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Opt / kons marked</span>
              <span className="tabular-nums">
                {formatNumber(Math.round(scenarioEnvelope.optimisticMarket))} /{" "}
                {formatNumber(Math.round(scenarioEnvelope.conservativeMarket))}
              </span>
            </div>
            <p className="text-muted-foreground text-xs pt-1">{confidence.method}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SSB-kalibrering</CardTitle>
            <CardDescription>
              Signalvekt {calibration.signalWeight} · clamp ±
              {Math.round((1 - calibration.indexMin) * 100)} %
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">MAPE ved valgt vekt</span>
              <span className="tabular-nums font-medium">
                {formatPercent(calibration.mapeAtWeight, 1)} %
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">OFV-kjerne MAPE</span>
              <span className="tabular-nums font-medium">
                {formatPercent(calibration.coreMape, 1)} %
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Slår kjerne?</span>
              <span className="font-medium">{calibration.beatsCore ? "Ja" : "Nei"}</span>
            </div>
            <p className="text-muted-foreground text-xs pt-1">{calibration.note}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segmentestimat {nextYear.year}</CardTitle>
          <CardDescription>
            Marked og Volvo-estimat per påbygg-segment, med segment-trend (CAGR).
            Klikk et segment for AdditionalBodyworks-fordeling.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Segment</th>
                <th className="pb-3 pr-4 font-medium">Driver</th>
                <th className="pb-3 pr-4 text-right font-medium">Trend</th>
                <th className="pb-3 pr-4 text-right font-medium">Driverfaktor</th>
                <th className="pb-3 pr-4 text-right font-medium">Analytiker</th>
                <th className="pb-3 pr-4 text-right font-medium">Marked</th>
                <th className="pb-3 pr-4 text-right font-medium">Volvo-andel</th>
                <th className="pb-3 text-right font-medium">Volvo-estimat</th>
              </tr>
            </thead>
            <tbody>
              {nextYear.segments.map((segment) => (
                <tr
                  key={segment.pabygg}
                  className="border-b border-border/50 hover:bg-muted/30"
                >
                  <td className="py-3 pr-4 font-medium">
                    <Link
                      href={buildDrilldownHref(String(segment.pabygg))}
                      className="text-volvo-blue underline-offset-2 hover:underline"
                    >
                      {segment.label}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {TMF_DRIVER_LABELS[segment.tmfDriver]}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {segment.trend.cagrPct === 0
                      ? "–"
                      : `${segment.trend.cagrPct > 0 ? "+" : ""}${formatPercent(segment.trend.cagrPct, 1)} %`}
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

      <Suspense fallback={null}>
        <TmfRegionSegmentPanel estimate={estimate} nextYear={nextYear} />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>SSB-driverindeks</CardTitle>
          <CardDescription>
            Gjennomsnittlig YoY-endring fra SSB, kalibrert vekt {calibration.signalWeight} og
            begrenset til ±{Math.round((1 - calibration.indexMin) * 100)} %
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
