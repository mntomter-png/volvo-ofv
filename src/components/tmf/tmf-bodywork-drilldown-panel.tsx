import { formatNumber, formatPercent } from "@/lib/format";
import { type PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfYearEstimateSegment } from "@/lib/tmf/types";
import { getTmfBodyworkDrilldown } from "@/lib/tmf/bodywork-drilldown";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfBodyworkDrilldownPanelProps {
  pabygg: PabyggSegment;
  segmentForecast2027: TmfYearEstimateSegment;
  scenarioLabel: string;
}

export async function TmfBodyworkDrilldownPanel({
  pabygg,
  segmentForecast2027,
  scenarioLabel,
}: TmfBodyworkDrilldownPanelProps) {
  const reference = new Date();
  const lastCompleteYear = reference.getFullYear() - 1;
  const startYear = Math.max(2020, lastCompleteYear - 4);
  const years = Array.from({ length: lastCompleteYear - startYear + 1 }, (_, i) => startYear + i);

  const result = await getTmfBodyworkDrilldown(pabygg, segmentForecast2027, years);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AdditionalBodyworks – {result.pabyggLabel}</CardTitle>
        <CardDescription>
          Historikk per år ({result.years[0]}–{result.years.at(-1)}) og 2027-forecast
          fordelt ned på undergruppene basert på trailing 12 måneder.
          <span className="block pt-1 text-muted-foreground">
            Scenario: {scenarioLabel}. Basert på {formatNumber(result.rowCount)}{" "}
            registreringer i segmentet. For Langtransport er AdditionalBodyworks typisk tom
            (trekkvogn) — segmentet styres av bruksområde.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-3 pr-4 font-medium">Bodywork</th>
              <th className="pb-3 pr-4 text-right font-medium">
                Trailing andel (marked)
              </th>
              {result.years.map((year) => (
                <th key={year} className="pb-3 pr-4 text-right font-medium">
                  {year}
                </th>
              ))}
              <th className="pb-3 pr-4 text-right font-medium">2027 marked</th>
              <th className="pb-3 text-right font-medium">2027 Volvo</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.bodyworkCode} className="border-b border-border/50">
                <td className="py-3 pr-4 font-medium">
                  {row.bodyworkCode === -999 ? row.bodyworkLabel : `${row.bodyworkCode} · ${row.bodyworkLabel}`}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {formatPercent(row.trailingMarketSharePct, 1)} %
                </td>
                {result.years.map((year) => {
                  const y = row.yearly.find((yy) => yy.year === year);
                  return (
                    <td key={year} className="py-3 pr-4 text-right tabular-nums">
                      {formatNumber(Math.round(y?.market ?? 0))}
                    </td>
                  );
                })}
                <td className="py-3 pr-4 text-right tabular-nums font-medium">
                  {formatNumber(Math.round(row.forecast2027.market))}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {formatNumber(Math.round(row.forecast2027.volvo))}
                </td>
              </tr>
            ))}

            {(() => {
              if (!result.others) return null;
              const others = result.others;
              return (
              <tr className="border-b border-border/50 bg-muted/30">
                <td className="pt-3 pr-4 font-medium">Andre</td>
                <td className="pt-3 pr-4 text-right tabular-nums">
                  {formatPercent(others.trailingMarketSharePct, 1)} %
                </td>
                {result.years.map((year) => {
                  const y = others.yearly.find((yy) => yy.year === year);
                  return (
                    <td key={year} className="pt-3 pr-4 text-right tabular-nums">
                      {formatNumber(Math.round(y?.market ?? 0))}
                    </td>
                  );
                })}
                <td className="pt-3 pr-4 text-right tabular-nums font-medium">
                  {formatNumber(Math.round(others.forecast2027.market))}
                </td>
                <td className="pt-3 text-right tabular-nums">
                  {formatNumber(Math.round(others.forecast2027.volvo))}
                </td>
              </tr>
              );
            })()}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

