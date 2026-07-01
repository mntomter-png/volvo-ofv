import { TrendingUp, Truck } from "lucide-react";

import { MetricCards } from "@/components/kpi/metric-cards";
import { formatNumber, formatPercent } from "@/lib/format";
import type { RegistrationsSummary } from "@/lib/registrations/queries";

interface RegistrationsSummaryCardsProps {
  summary: RegistrationsSummary;
  year: number;
}

export function RegistrationsSummaryCards({
  summary,
  year,
}: RegistrationsSummaryCardsProps) {
  const yoy = summary.yoy;

  return (
    <MetricCards
      cards={[
        {
          key: "total",
          title: "Nyregistreringer",
          value: formatNumber(summary.total),
          description: `Tunge lastebiler ≥ 16t i ${year}`,
          icon: Truck,
          yoy: yoy
            ? {
                current: summary.total,
                previous: yoy.total,
                periodLabel: yoy.periodLabel,
                mode: "percent",
                sentiment: "neutral",
              }
            : null,
        },
        {
          key: "volvo",
          title: "Volvo",
          value: formatNumber(summary.volvoCount),
          description: "Antall Volvo",
          icon: TrendingUp,
          yoy: yoy
            ? {
                current: summary.volvoCount,
                previous: yoy.volvoCount,
                periodLabel: yoy.periodLabel,
                mode: "percent",
                sentiment: "positive-growth",
              }
            : null,
        },
        {
          key: "share",
          title: "Volvo-andel",
          value: `${formatPercent(summary.volvoShare)} %`,
          description: "Av filtrert utvalg",
          icon: TrendingUp,
          yoy: yoy
            ? {
                current: summary.volvoShare,
                previous: yoy.volvoShare,
                periodLabel: yoy.periodLabel,
                mode: "points",
                sentiment: "positive-growth",
              }
            : null,
        },
      ]}
    />
  );
}
