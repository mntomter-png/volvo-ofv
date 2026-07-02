"use client";

import { AlertTriangle, CalendarClock, Clock, Truck, Users } from "lucide-react";

import { useBrand } from "@/components/brand/brand-provider";
import { MetricCards } from "@/components/kpi/metric-cards";
import type { PkkSummary } from "@/lib/pkk/queries";
import { formatNumber } from "@/lib/format";

interface PkkKpiCardsProps {
  summary: PkkSummary;
}

export function PkkKpiCards({ summary }: PkkKpiCardsProps) {
  const brand = useBrand();

  return (
    <div className="space-y-4">
      <MetricCards
        cards={[
          {
            key: "overdue",
            title: "Forfalt PKK",
            value: formatNumber(summary.overdueCount),
            description: `${brand.shortName}-kjøretøy hos storkunder`,
            icon: AlertTriangle,
          },
          {
            key: "due30",
            title: "Frist ≤ 30 dager",
            value: formatNumber(summary.due30Count),
            description: "Krever umiddelbar oppfølging",
            icon: Clock,
          },
          {
            key: "due90",
            title: "Frist ≤ 90 dager",
            value: formatNumber(summary.due90Count),
            description: "Planlegg kontakt med kunde",
            icon: CalendarClock,
          },
        ]}
      />

      <MetricCards
        cards={[
          {
            key: "due180",
            title: "Frist ≤ 6 måneder",
            value: formatNumber(summary.due180Count),
            description: "Inkluderer forfalte",
            icon: CalendarClock,
          },
          {
            key: "customers",
            title: "Storkunder",
            value: formatNumber(summary.customerCount),
            description: "I prioritert oppfølgingsliste",
            icon: Users,
          },
          {
            key: "fleet",
            title: `${brand.shortName}-flåte`,
            value: formatNumber(summary.volvoVehicles),
            description:
              summary.noPkkDateCount > 0
                ? `${formatNumber(summary.noPkkDateCount)} uten PKK-dato`
                : "Alle har PKK-dato",
            icon: Truck,
          },
        ]}
      />
    </div>
  );
}
