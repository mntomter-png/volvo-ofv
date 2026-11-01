"use client";

import { MapPin, PieChart, Target, TrendingUp } from "lucide-react";

import { useBrand } from "@/components/brand/brand-provider";
import { MetricCards } from "@/components/kpi/metric-cards";
import { registrationPeriodDescription } from "@/lib/kpi/yoy";
import { formatNumber, formatPercent } from "@/lib/format";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import {
  fleetFocusShareCaption,
  fleetVolumeCaption,
  nationalShareCaption,
} from "@/lib/registrations/fleet-share";
import type { RegionTabData } from "@/lib/registrations/queries";

export function RegionKpiCards({
  data,
  filters,
}: {
  data: RegionTabData;
  filters: Pick<RegistrationsFilters, "year" | "from" | "to" | "fleet">;
}) {
  const brand = useBrand();
  const periodDescription = registrationPeriodDescription(filters);
  const volumeNote = fleetVolumeCaption(filters.fleet);
  const shareNote = fleetFocusShareCaption(filters.fleet);
  const periodWithVolume = [periodDescription, volumeNote]
    .filter(Boolean)
    .join(" · ");
  const focusDescription = [
    `${formatNumber(data.scopedSummary.volvoCount)} ${brand.shortName}`,
    shareNote,
  ]
    .filter(Boolean)
    .join(" · ");
  const yoy = data.scopedSummary.yoy;
  const hasRegion = data.selectedRegionLabel != null;

  const cards = hasRegion
    ? [
        {
          key: "region-total",
          title: "Registreringer i region",
          value: formatNumber(data.scopedSummary.total),
          description: `${data.selectedRegionLabel} · ${periodWithVolume}`,
          icon: MapPin,
          yoy: yoy
            ? {
                current: data.scopedSummary.total,
                previous: yoy.total,
                periodLabel: yoy.periodLabel,
                mode: "percent" as const,
                sentiment: "neutral" as const,
              }
            : null,
        },
        {
          key: "region-share",
          title: `${brand.shareLabel} i region`,
          value: `${formatPercent(data.scopedSummary.volvoShare)} %`,
          description: focusDescription,
          icon: TrendingUp,
          yoy: yoy
            ? {
                current: data.scopedSummary.volvoShare,
                previous: yoy.volvoShare,
                periodLabel: yoy.periodLabel,
                mode: "points" as const,
                sentiment: "positive-growth" as const,
              }
            : null,
        },
        {
          key: "national-share",
          title: "Andel av Norge",
          value:
            data.nationalSharePct != null
              ? `${formatPercent(data.nationalSharePct)} %`
              : "—",
          description: nationalShareCaption(
            filters.fleet,
            formatNumber(data.nationalTotal),
          ),
          icon: PieChart,
        },
        {
          key: "districts",
          title: "Aktive distrikter",
          value: formatNumber(data.activeDistrictCount),
          description: "Distrikter med registreringer i utvalget",
          icon: Target,
        },
      ]
    : [
        {
          key: "national-total",
          title: "Nasjonalt",
          value: formatNumber(data.scopedSummary.total),
          description: periodWithVolume,
          icon: MapPin,
          yoy: yoy
            ? {
                current: data.scopedSummary.total,
                previous: yoy.total,
                periodLabel: yoy.periodLabel,
                mode: "percent" as const,
                sentiment: "neutral" as const,
              }
            : null,
        },
        {
          key: "national-focus-share",
          title: brand.shareLabel,
          value: `${formatPercent(data.scopedSummary.volvoShare)} %`,
          description: shareNote ?? `Nasjonal ${brand.shortName}-andel`,
          icon: TrendingUp,
          yoy: yoy
            ? {
                current: data.scopedSummary.volvoShare,
                previous: yoy.volvoShare,
                periodLabel: yoy.periodLabel,
                mode: "points" as const,
                sentiment: "positive-growth" as const,
              }
            : null,
        },
        {
          key: "top-region",
          title: "Største region",
          value: data.topRegion?.label ?? "—",
          description: data.topRegion
            ? `${formatNumber(data.topRegion.count)} reg. · ${formatPercent(data.topRegion.focusSharePct)} % ${brand.shortName}`
            : "Ingen data",
          icon: Target,
        },
        {
          key: "districts-national",
          title: "Distrikter",
          value: formatNumber(data.activeDistrictCount),
          description: "Med registreringer i perioden",
          icon: PieChart,
        },
      ];

  return <MetricCards cards={cards} />;
}
