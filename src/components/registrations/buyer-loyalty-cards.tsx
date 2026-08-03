"use client";

import { useState, useTransition } from "react";
import { Loader2, Percent, Target, UserPlus, Users } from "lucide-react";

import { useBrand } from "@/components/brand/brand-provider";
import { MetricCards } from "@/components/kpi/metric-cards";
import { TopBuyersTable } from "@/components/registrations/top-buyers-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getRegionLabel } from "@/lib/ofv/segmentation";
import {
  fetchBuyerLoyaltyOwners,
  type BuyerLoyaltyType,
} from "@/lib/registrations/buyer-loyalty-actions";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import {
  resolveBuyerLoyaltyPeriod,
  type BuyerLoyaltySummary,
  type TopBuyerRow,
} from "@/lib/registrations/queries";

const DIALOG_TITLES: Record<BuyerLoyaltyType, string> = {
  repeat: "Gjenkjøpere",
  new: "Nye i markedet",
  conquest: "Nye til merket",
};

export function BuyerLoyaltyCards({
  loyalty,
  filters,
}: {
  loyalty: BuyerLoyaltySummary;
  filters: RegistrationsFilters;
}) {
  const brand = useBrand();
  const [isPending, startTransition] = useTransition();
  const [dialogType, setDialogType] = useState<BuyerLoyaltyType | null>(null);
  const [owners, setOwners] = useState<TopBuyerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const period = resolveBuyerLoyaltyPeriod(filters);
  const periodLabel = `${formatDate(period.from)}–${formatDate(period.to)}`;
  const priorScope = filters.region
    ? getRegionLabel(filters.region)
    : "hele landet";

  const dialogDescriptions: Record<BuyerLoyaltyType, string> = {
    repeat: `Eiere med minst én tung lastebil-registrering før ${formatDate(period.from)} (${priorScope}). Sortert etter kjøp ${periodLabel}.`,
    new: `Eiere uten registrering før ${formatDate(period.from)} (${priorScope}). Sortert etter kjøp ${periodLabel}.`,
    conquest: `Eiere uten tidligere ${brand.shortName}-registrering før ${formatDate(period.from)}, men med ${brand.shortName}-kjøp i perioden. Handlingsliste for merkeovergang.`,
  };

  const totalPurchases =
    loyalty.repeat.purchase_count + loyalty.new.purchase_count;
  const repeatShare =
    totalPurchases > 0
      ? (loyalty.repeat.purchase_count / totalPurchases) * 100
      : 0;

  function openDialog(buyerType: BuyerLoyaltyType) {
    setDialogType(buyerType);
    setOwners([]);
    setError(null);
    startTransition(async () => {
      const result = await fetchBuyerLoyaltyOwners(filters, buyerType);
      setOwners(result.owners);
      setError(result.error ?? null);
    });
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Periode:</span>{" "}
        {periodLabel}.{" "}
        <span className="font-medium text-foreground">Sammenlignes mot:</span>{" "}
        registreringer før {formatDate(period.from)} i {priorScope} (tunge
        lastebiler ≥16t). Velg region i filteret for å se ditt område.
      </p>

      <MetricCards
        cards={[
          {
            key: "repeat",
            title: "Gjenkjøpere",
            value: formatNumber(loyalty.repeat.owner_count),
            description: `${formatNumber(loyalty.repeat.purchase_count)} kjøp i perioden`,
            icon: Users,
            footnote: `${formatNumber(loyalty.repeat.focus_count)} ${brand.shortName} · ${formatPercent(
              loyalty.repeat.purchase_count > 0
                ? (loyalty.repeat.focus_count / loyalty.repeat.purchase_count) *
                    100
                : 0,
            )} %`,
            onClick: () => openDialog("repeat"),
          },
          {
            key: "new",
            title: "Nye i markedet",
            value: formatNumber(loyalty.new.owner_count),
            description: `${formatNumber(loyalty.new.purchase_count)} kjøp i perioden`,
            icon: UserPlus,
            footnote: `${formatNumber(loyalty.new.focus_count)} ${brand.shortName} · ${formatPercent(
              loyalty.new.purchase_count > 0
                ? (loyalty.new.focus_count / loyalty.new.purchase_count) * 100
                : 0,
            )} %`,
            onClick: () => openDialog("new"),
          },
          {
            key: "conquest",
            title: `Nye til ${brand.shortName}`,
            value: formatNumber(loyalty.conquest.owner_count),
            description: `${formatNumber(loyalty.conquest.focus_count)} ${brand.shortName}-kjøp`,
            icon: Target,
            footnote: "Første gang hos merket — klikk for liste",
            onClick: () => openDialog("conquest"),
          },
          {
            key: "repeat-share",
            title: "Andel gjenkjøp",
            value: `${formatPercent(repeatShare)} %`,
            description: "Av alle kjøp i filtrert periode",
            icon: Percent,
            footnote: `Før ${formatDate(period.from)} · ${priorScope}`,
          },
        ]}
      />

      <Dialog
        open={dialogType !== null}
        onOpenChange={(open) => {
          if (!open) setDialogType(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogType ? DIALOG_TITLES[dialogType] : ""}
            </DialogTitle>
            <DialogDescription>
              {dialogType ? dialogDescriptions[dialogType] : ""}
            </DialogDescription>
          </DialogHeader>
          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Henter eiere…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <TopBuyersTable buyers={owners} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
