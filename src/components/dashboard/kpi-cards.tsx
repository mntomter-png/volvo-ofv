import { TrendingUp, Truck } from "lucide-react";

import {
  formatNumber,
  formatPercent,
  type DashboardKpis,
} from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  kpis: DashboardKpis;
}

const cards = [
  {
    key: "registrations",
    label: "Nyregistreringer YTD",
    icon: TrendingUp,
    getValue: (kpis: DashboardKpis) => formatNumber(kpis.totalRegistrationsYtd),
    getSub: (kpis: DashboardKpis) => `${formatNumber(kpis.volvoRegistrationsYtd)} Volvo`,
  },
  {
    key: "share",
    label: "Volvo-andel",
    icon: TrendingUp,
    getValue: (kpis: DashboardKpis) => `${formatPercent(kpis.volvoMarketShare)} %`,
    getSub: () => "Av nye lastebiler i år",
  },
  {
    key: "population",
    label: "Bestand totalt",
    icon: Truck,
    getValue: (kpis: DashboardKpis) => formatNumber(kpis.populationTotal),
    getSub: (kpis: DashboardKpis) =>
      kpis.populationSnapshotDate
        ? `Per ${kpis.populationSnapshotDate}`
        : "Ingen snapshot",
  },
] as const;

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const isVolvoShare = card.key === "share";

        return (
          <div
            key={card.key}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md",
                  isVolvoShare ? "bg-accent/30 text-volvo-blue" : "bg-primary/10 text-volvo-blue",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {card.getValue(kpis)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{card.getSub(kpis)}</p>
          </div>
        );
      })}
    </div>
  );
}
