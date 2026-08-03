import { formatNumber, formatPercent } from "@/lib/format";
import { type PabyggSegment } from "@/lib/ofv/segmentation";
import type { TmfSegmentForecast, TmfYearEstimateSegment } from "@/lib/tmf/types";
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
  segmentForecastNext: TmfYearEstimateSegment;
  segmentForecastCurrent: TmfSegmentForecast;
  scenarioLabel: string;
}

const MONTH_SHORT_NB = [
  "jan",
  "feb",
  "mar",
  "apr",
  "mai",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "des",
] as const;

function volvoSharePct(market: number, volvo: number): number | null {
  if (market <= 0) return null;
  return (volvo / market) * 100;
}

function formatShare(market: number, volvo: number): string {
  const share = volvoSharePct(market, volvo);
  return share == null ? "–" : `${formatPercent(share, 1)} %`;
}

function MarketVolvoCell({
  market,
  volvo,
  emphasizeMarket = false,
}: {
  market: number;
  volvo: number;
  emphasizeMarket?: boolean;
}) {
  return (
    <>
      <div className={emphasizeMarket ? "font-medium" : undefined}>
        {formatNumber(Math.round(market))}
      </div>
      <div className="text-muted-foreground text-xs">Volvo {formatShare(market, volvo)}</div>
    </>
  );
}

export async function TmfBodyworkDrilldownPanel({
  pabygg,
  segmentForecastNext,
  segmentForecastCurrent,
  scenarioLabel,
}: TmfBodyworkDrilldownPanelProps) {
  const reference = new Date();
  const lastCompleteYear = reference.getFullYear() - 1;
  const startYear = Math.max(2020, lastCompleteYear - 4);
  const years = Array.from({ length: lastCompleteYear - startYear + 1 }, (_, i) => startYear + i);

  const result = await getTmfBodyworkDrilldown(
    pabygg,
    segmentForecastNext,
    segmentForecastCurrent,
    years,
  );

  const ytdLabel =
    result.ytdThroughMonth > 0
      ? `${result.currentYear} YTD (jan–${MONTH_SHORT_NB[result.ytdThroughMonth - 1]})`
      : `${result.currentYear} YTD`;

  const tableRows = result.others ? [...result.rows, result.others] : result.rows;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AdditionalBodyworks – {result.pabyggLabel}</CardTitle>
        <CardDescription>
          Historikk per år ({result.years[0]}–{result.years.at(-1)}), {result.currentYear} YTD
          (til siste fullførte måned) og prognose for {result.currentYear}/{result.nextYear}
          fordelt ned på undergruppene basert på trailing 12 måneder. Volvo-andel = Volvo /
          marked.
          <span className="block pt-1 text-muted-foreground">
            Scenario: {scenarioLabel}. Basert på {formatNumber(result.rowCount)}{" "}
            registreringer i segmentet. For Langtransport er AdditionalBodyworks typisk tom
            (trekkvogn) — segmentet styres av bruksområde.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
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
              <th className="pb-3 pr-4 text-right font-medium">{ytdLabel}</th>
              <th className="pb-3 pr-4 text-right font-medium">
                {result.currentYear} prognose
              </th>
              <th className="pb-3 pr-4 text-right font-medium">{result.nextYear} marked</th>
              <th className="pb-3 text-right font-medium">{result.nextYear} Volvo</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              const isOthers = row.bodyworkCode === -999;
              return (
                <tr
                  key={row.bodyworkCode}
                  className={
                    isOthers
                      ? "border-b border-border/50 bg-muted/30"
                      : "border-b border-border/50"
                  }
                >
                  <td className={isOthers ? "pt-3 pr-4 font-medium" : "py-3 pr-4 font-medium"}>
                    {isOthers ? "Andre" : `${row.bodyworkCode} · ${row.bodyworkLabel}`}
                  </td>
                  <td
                    className={
                      isOthers
                        ? "pt-3 pr-4 text-right tabular-nums"
                        : "py-3 pr-4 text-right tabular-nums"
                    }
                  >
                    {formatPercent(row.trailingMarketSharePct, 1)} %
                  </td>
                  {result.years.map((year) => {
                    const y = row.yearly.find((yy) => yy.year === year);
                    const market = y?.market ?? 0;
                    const volvo = y?.volvo ?? 0;
                    return (
                      <td
                        key={year}
                        className={
                          isOthers
                            ? "pt-3 pr-4 text-right tabular-nums"
                            : "py-3 pr-4 text-right tabular-nums"
                        }
                      >
                        <MarketVolvoCell market={market} volvo={volvo} />
                      </td>
                    );
                  })}
                  <td
                    className={
                      isOthers
                        ? "pt-3 pr-4 text-right tabular-nums"
                        : "py-3 pr-4 text-right tabular-nums"
                    }
                  >
                    <MarketVolvoCell market={row.ytd.market} volvo={row.ytd.volvo} />
                  </td>
                  <td
                    className={
                      isOthers
                        ? "pt-3 pr-4 text-right tabular-nums"
                        : "py-3 pr-4 text-right tabular-nums"
                    }
                  >
                    <MarketVolvoCell
                      market={row.forecastCurrent.market}
                      volvo={row.forecastCurrent.volvo}
                      emphasizeMarket
                    />
                  </td>
                  <td
                    className={
                      isOthers
                        ? "pt-3 pr-4 text-right tabular-nums font-medium"
                        : "py-3 pr-4 text-right tabular-nums font-medium"
                    }
                  >
                    {formatNumber(Math.round(row.forecastNext.market))}
                  </td>
                  <td
                    className={
                      isOthers ? "pt-3 text-right tabular-nums" : "py-3 text-right tabular-nums"
                    }
                  >
                    <div className="font-medium">
                      {formatNumber(Math.round(row.forecastNext.volvo))}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatShare(row.forecastNext.market, row.forecastNext.volvo)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
