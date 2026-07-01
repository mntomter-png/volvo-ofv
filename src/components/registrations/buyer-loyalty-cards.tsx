"use client";

import { Percent, UserPlus, Users } from "lucide-react";

import { useBrand } from "@/components/brand/brand-provider";
import { MetricCards } from "@/components/kpi/metric-cards";
import { formatNumber, formatPercent } from "@/lib/format";
import type { BuyerLoyaltySummary } from "@/lib/registrations/queries";

export function BuyerLoyaltyCards({
  loyalty,
}: {
  loyalty: BuyerLoyaltySummary;
}) {
  const brand = useBrand();

  const repeatShare =
    loyalty.repeat.purchase_count + loyalty.new.purchase_count > 0
      ? (loyalty.repeat.purchase_count /
          (loyalty.repeat.purchase_count + loyalty.new.purchase_count)) *
        100
      : 0;

  return (
    <MetricCards
      cards={[
        {
          key: "repeat",
          title: "Gjentakende kjøpere",
          value: formatNumber(loyalty.repeat.owner_count),
          description: `${formatNumber(loyalty.repeat.purchase_count)} kjøp i perioden`,
          icon: Users,
          footnote: `${formatNumber(loyalty.repeat.focus_count)} ${brand.shortName} · ${formatPercent(
            loyalty.repeat.purchase_count > 0
              ? (loyalty.repeat.focus_count / loyalty.repeat.purchase_count) * 100
              : 0,
          )} %`,
        },
        {
          key: "new",
          title: "Nye kjøpere",
          value: formatNumber(loyalty.new.owner_count),
          description: `${formatNumber(loyalty.new.purchase_count)} kjøp i perioden`,
          icon: UserPlus,
          footnote: `${formatNumber(loyalty.new.focus_count)} ${brand.shortName} · ${formatPercent(
            loyalty.new.purchase_count > 0
              ? (loyalty.new.focus_count / loyalty.new.purchase_count) * 100
              : 0,
          )} %`,
        },
        {
          key: "repeat-share",
          title: "Andel gjentakende",
          value: `${formatPercent(repeatShare)} %`,
          description: "Av alle kjøp i filtrert periode",
          icon: Percent,
          footnote: "Eier med tidligere registrering før perioden",
        },
      ]}
    />
  );
}
