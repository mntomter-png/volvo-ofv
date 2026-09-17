import { formatNumber, formatPercent } from "@/lib/format";
import type { TmfSegmentForecast } from "@/lib/tmf/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfSegmentTableProps {
  year: number;
  segments: TmfSegmentForecast[];
}

function variancePct(actual: number, expected: number): number | null {
  if (expected === 0) return null;
  return ((actual - expected) / expected) * 100;
}

export function TmfSegmentTable({ year, segments }: TmfSegmentTableProps) {
  if (segments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Segmentprognose</CardTitle>
          <CardDescription>Ingen segmentdata tilgjengelig.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Segmentprognose {year}</CardTitle>
        <CardDescription>
          OFV-baseline, sesong, SSB/scenario-justering og drivlinje-split per påbygg-segment
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-3 pr-4 font-medium">Segment</th>
              <th className="pb-3 pr-4 text-right font-medium">Driver</th>
              <th className="pb-3 pr-4 text-right font-medium">Analytiker</th>
              <th className="pb-3 pr-4 text-right font-medium">Volvo-andel</th>
              <th className="pb-3 pr-4 text-right font-medium">YTD faktisk</th>
              <th className="pb-3 pr-4 text-right font-medium">Årsprog.</th>
              <th className="pb-3 pr-4 text-right font-medium">EMOB</th>
              <th className="pb-3 pr-4 text-right font-medium">Diesel</th>
              <th className="pb-3 pr-4 text-right font-medium">Gass</th>
              <th className="pb-3 text-right font-medium">YTD avvik</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => {
              const variance = variancePct(segment.ytdActual, segment.ytdAdjustedForecast);
              return (
                <tr key={segment.pabygg} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{segment.label}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    ×{segment.driverMultiplier.toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {segment.analystAdjustmentPct
                      ? `${segment.analystAdjustmentPct > 0 ? "+" : ""}${segment.analystAdjustmentPct} %`
                      : "–"}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatPercent(segment.baseline.volvoSharePct, 1)} %
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(segment.ytdActual)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(segment.annualAdjustedForecast))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(segment.annualEmob))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(segment.annualDiesel))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatNumber(Math.round(segment.annualGas))}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {variance == null ? (
                      "–"
                    ) : (
                      <span
                        className={
                          variance > 0
                            ? "text-emerald-600"
                            : variance < 0
                              ? "text-red-600"
                              : ""
                        }
                      >
                        {variance > 0 ? "+" : ""}
                        {formatPercent(variance)} %
                      </span>
                    )}
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
