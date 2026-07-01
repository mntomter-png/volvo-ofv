"use client";

import { TrendingUp, Truck } from "lucide-react";

import { useBrand } from "@/components/brand/brand-provider";
import { MetricCards } from "@/components/kpi/metric-cards";
import { registrationPeriodDescription } from "@/lib/kpi/yoy";
import { formatNumber, formatPercent } from "@/lib/format";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import type { RegistrationsSummary } from "@/lib/registrations/queries";

interface RegistrationsSummaryCardsProps {
  summary: RegistrationsSummary;
  filters: Pick<RegistrationsFilters, "year" | "from" | "to">;
}

export function RegistrationsSummaryCards({
  summary,
  filters,
}: RegistrationsSummaryCardsProps) {
  const brand = useBrand();
  const yoy = summary.yoy;
  const periodDescription = registrationPeriodDescription(filters);

  return (
    <MetricCards
      cards={[
        {
          key: "total",
          title: "Nyregistreringer",
          value: formatNumber(summary.total),
          description: periodDescription,
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
          key: "focus",
          title: brand.shortName,
          value: formatNumber(summary.volvoCount),
          description: `Antall ${brand.shortName}`,
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
          title: brand.shareLabel,
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
