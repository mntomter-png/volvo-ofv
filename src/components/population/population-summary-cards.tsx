import { Truck } from "lucide-react";

import {
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/dashboard/queries";
import type { PopulationSummary } from "@/lib/population/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PopulationSummaryCardsProps {
  summary: PopulationSummary;
  snapshotDate: string | null;
}

export function PopulationSummaryCards({
  summary,
  snapshotDate,
}: PopulationSummaryCardsProps) {
  const cards = [
    {
      title: "Bestand totalt",
      value: formatNumber(summary.total),
      description: snapshotDate
        ? `Tunge lastebiler > 16t per ${formatDate(snapshotDate)}`
        : "Venter på datasynk",
      icon: Truck,
    },
    {
      title: "Volvo i bestand",
      value: formatNumber(summary.volvoCount),
      description: "Antall Volvo",
      icon: Truck,
    },
    {
      title: "Volvo-andel",
      value: `${formatPercent(summary.volvoShare)} %`,
      description: "Av filtrert bestand",
      icon: Truck,
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-volvo-blue" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
