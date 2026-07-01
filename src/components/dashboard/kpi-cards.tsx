"use client";

import { TrendingUp, Truck } from "lucide-react";

import { useBrand } from "@/components/brand/brand-provider";
import { MetricCards } from "@/components/kpi/metric-cards";
import type { DashboardKpis } from "@/lib/dashboard/queries";
import { formatNumber, formatPercent } from "@/lib/format";

interface KpiCardsProps {
  kpis: DashboardKpis;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const brand = useBrand();
  const year = new Date().getFullYear();
  const regYoy = kpis.registrationsYoy;
  const popYoy = kpis.populationYoy;

  return (
    <MetricCards
      cards={[
        {
          key: "registrations",
          title: "Nyregistreringer YTD",
          value: formatNumber(kpis.totalRegistrationsYtd),
          description: `Tunge lastebiler ≥ 16t i ${year}`,
          footnote: `${formatNumber(kpis.volvoRegistrationsYtd)} ${brand.shortName}`,
          icon: TrendingUp,
          yoy: regYoy
            ? {
                current: kpis.totalRegistrationsYtd,
                previous: regYoy.total,
                periodLabel: regYoy.periodLabel,
                mode: "percent",
                sentiment: "neutral",
              }
            : null,
        },
        {
          key: "share",
          title: brand.shareLabel,
          value: `${formatPercent(kpis.volvoMarketShare)} %`,
          description: "Av nye lastebiler i år",
          icon: TrendingUp,
          yoy: regYoy
            ? {
                current: kpis.volvoMarketShare,
                previous: regYoy.volvoShare,
                periodLabel: regYoy.periodLabel,
                mode: "points",
                sentiment: "positive-growth",
              }
            : null,
        },
        {
          key: "population",
          title: "Bestand totalt",
          value: formatNumber(kpis.populationTotal),
          description: kpis.populationSnapshotDate
            ? `Per ${kpis.populationSnapshotDate}`
            : "Ingen snapshot",
          icon: Truck,
          yoy: popYoy
            ? {
                current: kpis.populationTotal,
                previous: popYoy.total,
                periodLabel: popYoy.periodLabel,
                mode: "percent",
                sentiment: "neutral",
              }
            : null,
        },
      ]}
    />
  );
}
