import { TrendingUp, Truck } from "lucide-react";

import {
  formatNumber,
  formatPercent,
} from "@/lib/dashboard/queries";
import type { RegistrationsSummary } from "@/lib/registrations/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RegistrationsSummaryCardsProps {
  summary: RegistrationsSummary;
  year: number;
}

export function RegistrationsSummaryCards({
  summary,
  year,
}: RegistrationsSummaryCardsProps) {
  const cards = [
    {
      title: "Nyregistreringer",
      value: formatNumber(summary.total),
      description: `Tunge lastebiler > 16t i ${year}`,
      icon: Truck,
    },
    {
      title: "Volvo",
      value: formatNumber(summary.volvoCount),
      description: "Antall Volvo",
      icon: TrendingUp,
    },
    {
      title: "Volvo-andel",
      value: `${formatPercent(summary.volvoShare)} %`,
      description: "Av filtrert utvalg",
      icon: TrendingUp,
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
