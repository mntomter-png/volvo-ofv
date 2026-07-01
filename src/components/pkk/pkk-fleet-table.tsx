"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { useBrand } from "@/components/brand/brand-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatNumber } from "@/lib/format";
import {
  fetchPkkOwnerVehicles,
  type PkkOwnerVehicleRow,
} from "@/lib/pkk/actions";
import type { PopulationFilters } from "@/lib/population/filters";
import type { PkkFleetOwnerRow } from "@/lib/pkk/queries";

function formatPkkDate(iso: string | null): string {
  if (!iso) return "—";
  return formatDate(iso);
}

function PkkVehicleTable({ rows }: { rows: PkkOwnerVehicleRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen kjøretøy i utvalget.
      </p>
    );
  }

  return (
    <div className="max-h-[min(60vh,28rem)] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Reg.nr.</th>
            <th className="py-2 pr-3 font-medium">Modell</th>
            <th className="py-2 pr-3 font-medium">1. reg.</th>
            <th className="py-2 pr-3 font-medium">Siste PKK</th>
            <th className="py-2 font-medium">Neste frist</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.registration_number} className="border-b border-border/60">
              <td className="py-2 pr-3 font-medium tabular-nums">
                {row.registration_number}
              </td>
              <td className="py-2 pr-3">{row.model_name ?? "—"}</td>
              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                {formatPkkDate(row.first_registration_date)}
              </td>
              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                {formatPkkDate(row.pkk_last_date)}
              </td>
              <td className="py-2 tabular-nums text-muted-foreground">
                {formatPkkDate(row.pkk_next_deadline)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PkkFleetTable({
  owners,
  filters,
}: {
  owners: PkkFleetOwnerRow[];
  filters: PopulationFilters;
}) {
  const brand = useBrand();
  const [isPending, startTransition] = useTransition();
  const [dialogOwner, setDialogOwner] = useState<PkkFleetOwnerRow | null>(null);
  const [vehicles, setVehicles] = useState<PkkOwnerVehicleRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (owners.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ingen flåter i utvalget.</p>
    );
  }

  function openOwner(owner: PkkFleetOwnerRow) {
    setDialogOwner(owner);
    setVehicles([]);
    setError(null);
    startTransition(async () => {
      const result = await fetchPkkOwnerVehicles(filters, owner.owner_key);
      setVehicles(result.vehicles);
      setError(result.error ?? null);
    });
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Eier</th>
            <th className="py-2 pr-3 text-right font-medium">
              {brand.shortName}
            </th>
            <th className="py-2 pr-3 text-right font-medium">Totalt</th>
            <th className="py-2 text-right font-medium">PKK ≤ 90 d.</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((owner, index) => (
            <tr
              key={owner.owner_key}
              className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/50"
              onClick={() => openOwner(owner)}
            >
              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                {index + 1}
              </td>
              <td className="py-2 pr-3 font-medium">{owner.owner_name}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatNumber(owner.focus_count)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                {formatNumber(owner.total_count)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {owner.pkk_due_count > 0 ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {formatNumber(owner.pkk_due_count)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog
        open={dialogOwner != null}
        onOpenChange={(open) => {
          if (!open) setDialogOwner(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogOwner?.owner_name}</DialogTitle>
            <DialogDescription>
              {brand.shortName}-kjøretøy i flåten. Sortert etter neste PKK-frist.
            </DialogDescription>
          </DialogHeader>
          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Henter kjøretøy …
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <PkkVehicleTable rows={vehicles} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
