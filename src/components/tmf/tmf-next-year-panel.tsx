import type { Route } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

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
import { TmfNarrativePanel } from "@/components/tmf/tmf-narrative-panel";
import { TmfRegionSegmentPanel } from "@/components/tmf/tmf-region-segment-panel";
import { TmfTechnicalDetails } from "@/components/tmf/tmf-technical-details";
import { cn } from "@/lib/utils";

interface TmfNextYearPanelProps {
  estimate: TmfEstimateResult;
  selectedPabygg?: string | null;
  bodyworkDrilldown?: ReactNode;
}

export function TmfNextYearPanel({
  estimate,
  selectedPabygg = null,
  bodyworkDrilldown = null,
}: TmfNextYearPanelProps) {
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
    return `/tmf?${params.toString()}#tmf-bodywork-drilldown` as Route;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">
          Markedspotensial {nextYear.year} (OFV-registreringer)
        </h2>
        <p className="text-muted-foreground text-sm">
          Prognose for OFV-nyregistreringer ({scenarioLabel.toLowerCase()}).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <CardDescription>
              Vs. {estimate.currentYear.year} (anslått landing)
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatPercent(
                estimate.currentYear.total.annualLandingEstimate > 0
                  ? ((nextYear.total.annualMarket -
                      estimate.currentYear.total.annualLandingEstimate) /
                      estimate.currentYear.total.annualLandingEstimate) *
                      100
                  : 0,
                1,
              )}{" "}
              %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              {estimate.currentYear.year} anslås til{" "}
              {formatNumber(
                Math.round(estimate.currentYear.total.annualLandingEstimate),
              )}{" "}
              ({estimate.currentYear.total.landingActualMonths} mnd faktisk + resten
              prognose)
              {nextYear.trendApplied
                ? ` · trendvekt ${nextYear.trendWeight}`
                : " · trend kalibrert av"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drivlinje {nextYear.year}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatPercent(nextYear.total.emobSharePct, 1)} %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              EMOB {formatNumber(Math.round(nextYear.total.annualEmob))} · ICE{" "}
              {formatNumber(Math.round(nextYear.total.annualIce))} (trailing 12 mnd-andel)
            </p>
          </CardContent>
        </Card>
      </div>

      <TmfNarrativePanel estimate={estimate} />

      <Card>
        <CardHeader>
          <CardTitle>Segmentestimat {nextYear.year}</CardTitle>
          <CardDescription>
            Marked, Volvo og drivlinje (ICE/EMOB) per segment. Trend-kolonnen viser
            utslaget som faktisk er brukt (trendvekt {calibration.trendWeight}), med den
            målte trenden under. Volvo-andel blander rullerende 12 mnd med YTD. EMOB-andel
            = trailing 12 mnd. Klikk segment for AdditionalBodyworks.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Segment</th>
                <th className="pb-3 pr-4 font-medium">Driver</th>
                <th className="pb-3 pr-4 text-right font-medium">Trend</th>
                <th className="pb-3 pr-4 text-right font-medium">Driverfaktor</th>
                <th className="pb-3 pr-4 text-right font-medium">Analytiker</th>
                <th className="pb-3 pr-4 text-right font-medium">Marked</th>
                <th className="pb-3 pr-4 text-right font-medium">EMOB-andel</th>
                <th className="pb-3 pr-4 text-right font-medium">EMOB</th>
                <th className="pb-3 pr-4 text-right font-medium">ICE</th>
                <th className="pb-3 pr-4 text-right font-medium">Volvo-andel</th>
                <th className="pb-3 text-right font-medium">Volvo-estimat</th>
              </tr>
            </thead>
            <tbody>
              {nextYear.segments.map((segment) => {
                const isSelected = selectedPabygg === String(segment.pabygg);
                return (
                <tr
                  key={segment.pabygg}
                  className={cn(
                    "border-b border-border/50 hover:bg-muted/30",
                    isSelected && "bg-volvo-blue/5",
                  )}
                >
                  <td className="py-3 pr-4 font-medium">
                    <Link
                      href={buildDrilldownHref(String(segment.pabygg))}
                      className={cn(
                        "underline-offset-2 hover:underline",
                        isSelected ? "text-volvo-blue font-semibold" : "text-volvo-blue",
                      )}
                    >
                      {segment.label}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {TMF_DRIVER_LABELS[segment.tmfDriver]}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {segment.trend.cagrPct === 0 &&
                    segment.trend.ytdMomentumPct == null ? (
                      "–"
                    ) : (
                      <div>
                        <div className={nextYear.trendWeight === 0 ? "text-muted-foreground" : ""}>
                          {nextYear.trendWeight === 0
                            ? "0 %"
                            : `${nextYear.trendWeight * segment.trend.cagrPct > 0 ? "+" : ""}${formatPercent(nextYear.trendWeight * segment.trend.cagrPct, 1)} %`}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {nextYear.trendWeight === 0 ? "avslått · " : null}
                          målt{" "}
                          {segment.trend.cagrPct > 0 ? "+" : ""}
                          {formatPercent(segment.trend.cagrPct, 1)} %
                          {segment.trend.ytdMonthsUsed >= 3
                            ? ` (hist ${segment.trend.historicalCagrPct > 0 ? "+" : ""}${formatPercent(segment.trend.historicalCagrPct, 1)} %, YTD ${
                                segment.trend.ytdMomentumPct == null
                                  ? "–"
                                  : `${segment.trend.ytdMomentumPct > 0 ? "+" : ""}${formatPercent(segment.trend.ytdMomentumPct, 1)} %`
                              })`
                            : null}
                        </div>
                      </div>
                    )}
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
                    {formatPercent(segment.emobSharePct, 1)} %
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(segment.annualEmob))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(segment.annualIce))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    <div>
                      {formatPercent(segment.volvoSharePct, 1)} %
                      {segment.volvoShareOverridden ? " *" : ""}
                    </div>
                    {!segment.volvoShareOverridden &&
                    segment.volvoShareYtdPct != null ? (
                      <div className="text-muted-foreground text-xs">
                        12 mnd {formatPercent(segment.volvoShareTrailingPct, 1)} % · YTD{" "}
                        {formatPercent(segment.volvoShareYtdPct, 1)} %
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 text-right font-medium tabular-nums">
                    {formatNumber(Math.round(segment.annualVolvo))}
                  </td>
                </tr>
                );
              })}
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
                  {formatPercent(nextYear.total.emobSharePct, 1)} %
                </td>
                <td className="pt-3 pr-4 text-right tabular-nums">
                  {formatNumber(Math.round(nextYear.total.annualEmob))}
                </td>
                <td className="pt-3 pr-4 text-right tabular-nums">
                  {formatNumber(Math.round(nextYear.total.annualIce))}
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

      {bodyworkDrilldown ? (
        <div id="tmf-bodywork-drilldown" className="scroll-mt-6">
          {bodyworkDrilldown}
        </div>
      ) : null}

      <Suspense fallback={null}>
        <TmfRegionSegmentPanel estimate={estimate} nextYear={nextYear} />
      </Suspense>

      <TmfTechnicalDetails>
        {confidence.segments.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Usikkerhet per segment {nextYear.year}</CardTitle>
              <CardDescription>
                Båndene er asymmetriske fordi den historiske feilen er det. Bredden per
                segment kommer fra segmentets eget avvik i «{confidence.modelLabel}».
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Segment</th>
                    <th className="pb-3 pr-4 text-right font-medium">Marked P10</th>
                    <th className="pb-3 pr-4 text-right font-medium">P50</th>
                    <th className="pb-3 pr-4 text-right font-medium">P90</th>
                    <th className="pb-3 pr-4 text-right font-medium">Volvo P10–P90</th>
                    <th className="pb-3 text-right font-medium">Bånd (ned / opp)</th>
                  </tr>
                </thead>
                <tbody>
                  {confidence.segments.map((segment) => (
                    <tr key={segment.pabygg} className="border-b border-border/50">
                      <td className="py-3 pr-4 font-medium">{segment.label}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatNumber(Math.round(segment.market.p10))}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium tabular-nums">
                        {formatNumber(Math.round(segment.market.p50))}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatNumber(Math.round(segment.market.p90))}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatNumber(Math.round(segment.volvo.p10))}–
                        {formatNumber(Math.round(segment.volvo.p90))}
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        −{formatPercent(segment.downsidePct, 1)} % / +
                        {formatPercent(segment.upsidePct, 1)} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Usikkerhetsbånd totalt</CardTitle>
              <CardDescription>
                MAPE {formatPercent(confidence.mapeUsed, 1)} % fra «{confidence.modelLabel}»
                · nedside −{formatPercent(confidence.downsidePct, 1)} % / oppside +
                {formatPercent(confidence.upsidePct, 1)} % · scenariospenn{" "}
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
              <CardTitle className="text-base">Kalibrering</CardTitle>
              <CardDescription>
                Trendvekt {calibration.trendWeight} · signalvekt{" "}
                {calibration.signalWeight} · makrovekt {calibration.macroWeight} · clamp ±
                {Math.round((1 - calibration.indexMin) * 100)} %
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {calibration.trendCandidates.length > 0 ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">MAPE per trendvekt</span>
                  <span className="tabular-nums text-xs">
                    {calibration.trendCandidates
                      .map(
                        (candidate) =>
                          `${candidate.trendWeight}: ${formatPercent(candidate.mape, 1)} %`,
                      )
                      .join(" · ")}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">MAPE ved valgt vekt</span>
                <span className="tabular-nums font-medium">
                  {formatPercent(calibration.mapeAtWeight, 1)} %
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Samme modell uten SSB</span>
                <span className="tabular-nums font-medium">
                  {formatPercent(calibration.noSsbMape, 1)} %
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Bedre med SSB?</span>
                <span className="font-medium">{calibration.beatsNoSsb ? "Ja" : "Nei"}</span>
              </div>
              <p className="text-muted-foreground text-xs pt-1">{calibration.note}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>SSB-driverindeks</CardTitle>
            <CardDescription>
              Gjennomsnittlig YoY-endring fra SSB, kalibrert vekt {calibration.signalWeight}{" "}
              og begrenset til ±{Math.round((1 - calibration.indexMin) * 100)} %. Makro
              legges i tillegg over alle segmenter med vekt {calibration.macroWeight}.
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
      </TmfTechnicalDetails>
    </div>
  );
}
