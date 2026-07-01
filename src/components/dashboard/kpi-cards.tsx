import { TrendingUp, Truck } from "lucide-react";

import { MetricCards } from "@/components/kpi/metric-cards";
import {
  formatNumber,
  formatPercent,
  type DashboardKpis,
} from "@/lib/dashboard/queries";

interface KpiCardsProps {
  kpis: DashboardKpis;
}

export function KpiCards({ kpis }: KpiCardsProps) {
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
          footnote: `${formatNumber(kpis.volvoRegistrationsYtd)} Volvo`,
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
          title: "Volvo-andel",
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
