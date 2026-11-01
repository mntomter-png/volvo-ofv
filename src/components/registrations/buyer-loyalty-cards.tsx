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
import { resolveBuyerLoyaltyPeriod } from "@/lib/registrations/period";
import type {
  BuyerLoyaltySummary,
  TopBuyerRow,
} from "@/lib/registrations/queries";
import {
  customerPartyLabel,
  type CustomerParty,
} from "@/lib/ofv/customer-party";
import type { FleetFilter } from "@/lib/fleet";
import {
  FLEET_LOYALTY_NOTE,
  focusSharePercent,
} from "@/lib/registrations/fleet-share";

const DIALOG_TITLES: Record<BuyerLoyaltyType, string> = {
  repeat: "Gjenkjøpere",
  new: "Nye i markedet",
  conquest: "Nye til merket",
};

export function BuyerLoyaltyCards({
  loyalty,
  filters,
  customerParty = "user",
  fleetFilter,
}: {
  loyalty: BuyerLoyaltySummary;
  filters: RegistrationsFilters;
  customerParty?: CustomerParty;
  /** Satt på region-fanen. Uten prop brukes kjøper-RPC-en uten fleet-filter. */
  fleetFilter?: FleetFilter;
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
  const partyWord = customerPartyLabel(customerParty).toLowerCase();

  const dialogDescriptions: Record<BuyerLoyaltyType, string> = {
    repeat: `${customerPartyLabel(customerParty)}e med minst én tung lastebil-registrering før ${formatDate(period.from)} (${priorScope}). Sortert etter kjøp ${periodLabel}.`,
    new: `${customerPartyLabel(customerParty)}e uten registrering før ${formatDate(period.from)} (${priorScope}). Sortert etter kjøp ${periodLabel}.`,
    conquest: `${customerPartyLabel(customerParty)}e uten tidligere ${brand.shortName}-registrering før ${formatDate(period.from)}, men med ${brand.shortName}-kjøp i perioden. Handlingsliste for merkeovergang.`,
  };

  const totalPurchases =
    loyalty.repeat.purchase_count + loyalty.new.purchase_count;
  const repeatShare =
    totalPurchases > 0
      ? (loyalty.repeat.purchase_count / totalPurchases) * 100
      : 0;
  const activeFleet = fleetFilter ?? "all";

  function bucketShare(bucket: BuyerLoyaltySummary["repeat"]): number {
    return focusSharePercent(activeFleet, {
      volume: bucket.purchase_count,
      focus: bucket.focus_count,
      marketVolume: bucket.market_purchase_count ?? bucket.purchase_count,
    });
  }

  function openDialog(buyerType: BuyerLoyaltyType) {
    setDialogType(buyerType);
    setOwners([]);
    setError(null);
    startTransition(async () => {
      const result = await fetchBuyerLoyaltyOwners(
        filters,
        buyerType,
        customerParty,
        fleetFilter ? { fleetAware: true } : undefined,
      );
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
        lastebiler ≥16t). Gruppert på {partyWord}. Velg region i filteret for å
        se ditt område.
        {fleetFilter && fleetFilter !== "all" ? ` ${FLEET_LOYALTY_NOTE}` : ""}
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
              bucketShare(loyalty.repeat),
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
              bucketShare(loyalty.new),
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
              Henter {partyWord}e…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <TopBuyersTable
              buyers={owners}
              partyLabel={customerPartyLabel(customerParty)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
