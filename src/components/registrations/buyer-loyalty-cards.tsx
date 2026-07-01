"use client";

import { useState, useTransition } from "react";
import { Loader2, Percent, UserPlus, Users } from "lucide-react";

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
import { formatNumber, formatPercent } from "@/lib/format";
import {
  fetchBuyerLoyaltyOwners,
  type BuyerLoyaltyType,
} from "@/lib/registrations/buyer-loyalty-actions";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import type {
  BuyerLoyaltySummary,
  TopBuyerRow,
} from "@/lib/registrations/queries";

const DIALOG_TITLES: Record<BuyerLoyaltyType, string> = {
  repeat: "Gjentakende kjøpere",
  new: "Nye kjøpere",
};

const DIALOG_DESCRIPTIONS: Record<BuyerLoyaltyType, string> = {
  repeat:
    "Eiere med minst én tung lastebil-registrering før perioden. Sortert etter antall kjøp i utvalget.",
  new: "Eiere uten tidligere registrering før perioden. Sortert etter antall kjøp i utvalget.",
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

  const repeatShare =
    loyalty.repeat.purchase_count + loyalty.new.purchase_count > 0
      ? (loyalty.repeat.purchase_count /
          (loyalty.repeat.purchase_count + loyalty.new.purchase_count)) *
        100
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
            onClick: () => openDialog("repeat"),
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
            onClick: () => openDialog("new"),
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
              {dialogType ? DIALOG_DESCRIPTIONS[dialogType] : null}
              {dialogType ? " Viser inntil 100 eiere." : null}
            </DialogDescription>
          </DialogHeader>

          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Henter eiere …
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <TopBuyersTable buyers={owners} countLabel="Kjøp" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
