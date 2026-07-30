import { formatNumber, formatPercent } from "@/lib/format";
import { getPabyggSegmentLabel, type PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfEstimateResult, TmfYearEstimate } from "@/lib/tmf/types";
import { getTmfRegionSegmentForecastP50 } from "@/lib/tmf/region-segment";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfRegionSegmentPanelProps {
  estimate: TmfEstimateResult;
  nextYear: TmfYearEstimate;
}

function formatVolvoLine(market: number, volvo: number): string {
  if (market <= 0) return `Volvo: ${formatNumber(Math.round(volvo))}`;
  const share = (volvo / market) * 100;
  return `Volvo: ${formatNumber(Math.round(volvo))} (${formatPercent(share, 1)} %)`;
}

export async function TmfRegionSegmentPanel({
  estimate,
  nextYear,
}: TmfRegionSegmentPanelProps) {
  const pabyggSegments = nextYear.segments
    .map((s) => s.pabygg)
    .filter((s): s is PabyggSegment => typeof s === "string") as PabyggSegment[];

  const segmentLabelByKey = Object.fromEntries(
    nextYear.segments.map((s) => [String(s.pabygg), s.label]),
  );

  const forecast = await getTmfRegionSegmentForecastP50(pabyggSegments, nextYear);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Region × segment – {nextYear.year}</CardTitle>
        <CardDescription>
          Fordelt fra segment-forecast basert på trailing 12 mnd andeler. Scenario:{" "}
          {estimate.scenarioLabel}. Volvo-andel = Volvo / marked i cellen.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-3 pr-4 font-medium">Region</th>
              {forecast.segments.map((segKey) => (
                <th key={segKey} className="pb-3 pr-4 font-medium text-right">
                  {segmentLabelByKey[segKey] ?? getPabyggSegmentLabel(segKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forecast.regions.map((regionRow) => (
              <tr key={regionRow.region} className="border-b border-border/50">
                <td className="py-3 pr-4 font-medium">{regionRow.label}</td>
                {forecast.segments.map((segKey) => {
                  const cell = regionRow.cells[segKey] ?? {
                    region: regionRow.region,
                    market: 0,
                    volvo: 0,
                  };
                  return (
                    <td key={segKey} className="py-3 pr-4 text-right tabular-nums">
                      <div className="font-medium">{formatNumber(Math.round(cell.market))}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatVolvoLine(cell.market, cell.volvo)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr className="font-medium">
              <td className="pt-3 pr-4">Totalt (sjekk)</td>
              {forecast.segments.map((segKey) => {
                const totalMarket = forecast.regions.reduce(
                  (s, r) => s + (r.cells[segKey]?.market ?? 0),
                  0,
                );
                const totalVolvo = forecast.regions.reduce(
                  (s, r) => s + (r.cells[segKey]?.volvo ?? 0),
                  0,
                );
                return (
                  <td key={segKey} className="pt-3 pr-4 text-right tabular-nums">
                    <div>{formatNumber(Math.round(totalMarket))}</div>
                    <div className="text-muted-foreground text-xs">
                      {formatVolvoLine(totalMarket, totalVolvo)}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
