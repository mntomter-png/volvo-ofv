import { formatNumber } from "@/lib/format";
import { buildTmfNarrative } from "@/lib/tmf/narrative";
import type { TmfEstimateResult } from "@/lib/tmf/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TmfNarrativePanelProps {
  estimate: TmfEstimateResult;
}

export function TmfNarrativePanel({ estimate }: TmfNarrativePanelProps) {
  const narrative = buildTmfNarrative(estimate);
  const { nextYear, currentYear } = estimate;
  const currentMarket = currentYear.total.annualAdjustedForecast;
  const nextMarket = nextYear.total.annualMarket;
  const deltaPct =
    currentMarket > 0 ? ((nextMarket - currentMarket) / currentMarket) * 100 : 0;

  return (
    <Card className="border-volvo-blue/25 bg-volvo-blue/[0.03]">
      <CardHeader>
        <CardDescription>
          Oppsummering · {currentYear.year} → {nextYear.year} ·{" "}
          {formatNumber(Math.round(currentMarket))} → {formatNumber(Math.round(nextMarket))}{" "}
          ({deltaPct > 0 ? "+" : ""}
          {deltaPct.toFixed(1).replace(".", ",")} %)
        </CardDescription>
        <CardTitle className="text-xl leading-snug">{narrative.headline}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground leading-relaxed">{narrative.lead}</p>

        <div>
          <p className="mb-2 font-medium">Hvordan kommer tallet frem?</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            {narrative.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 font-medium">Viktig å huske</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            {narrative.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
