"use client";

import { TrendingUp, Truck } from "lucide-react";

import { useBrand } from "@/components/brand/brand-provider";
import { MetricCards } from "@/components/kpi/metric-cards";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { PopulationSummary } from "@/lib/population/queries";

interface PopulationSummaryCardsProps {
  summary: PopulationSummary;
  snapshotDate: string | null;
}

export function PopulationSummaryCards({
  summary,
  snapshotDate,
}: PopulationSummaryCardsProps) {
  const brand = useBrand();
  const yoy = summary.yoy;

  return (
    <MetricCards
      cards={[
        {
          key: "total",
          title: "Bestand totalt",
          value: formatNumber(summary.total),
          description: snapshotDate
            ? `Tunge lastebiler ≥ 16t per ${formatDate(snapshotDate)}`
            : "Venter på datasynk",
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
          title: `${brand.shortName} i bestand`,
          value: formatNumber(summary.volvoCount),
          description: `Antall ${brand.shortName}`,
          icon: Truck,
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
          description: "Av filtrert bestand",
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
