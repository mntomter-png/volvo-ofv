"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { PkkCustomerContact } from "@/components/pkk/pkk-customer-contact";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import { getRegionLabel } from "@/lib/ofv/segmentation";
import {
  fetchPkkOwnerVehicles,
  type PkkOwnerVehicleRow,
} from "@/lib/pkk/actions";
import type { PkkFilters } from "@/lib/pkk/filters";
import type { PkkCustomerNotesMap } from "@/lib/pkk/note-actions";
import {
  customerNeedsFollowUp,
  getPkkPriority,
  PKK_PRIORITY_CLASSES,
  PKK_PRIORITY_LABELS,
} from "@/lib/pkk/priority";
import type { PkkCustomerRow } from "@/lib/pkk/queries";
import { cn } from "@/lib/utils";

function formatDeadline(iso: string | null, days: number | null): string {
  if (!iso) return "Ukjent";
  if (days != null && days < 0) {
    return `${formatDate(iso)} (${formatNumber(Math.abs(days))} d. forfalt)`;
  }
  if (days === 0) return `${formatDate(iso)} (i dag)`;
  if (days != null) return `${formatDate(iso)} (${formatNumber(days)} d.)`;
  return formatDate(iso);
}

function VehicleSubTable({ rows }: { rows: PkkOwnerVehicleRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
        Ingen kjøretøy med PKK-frist innen 6 måneder.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border-t border-border bg-muted/20">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Reg.nr.</th>
            <th className="px-4 py-2 font-medium">Modell</th>
            <th className="px-4 py-2 font-medium">Siste PKK</th>
            <th className="px-4 py-2 font-medium">Neste frist</th>
            <th className="px-4 py-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const days = row.days_until_due;
            const statusClass =
              days == null
                ? "text-muted-foreground"
                : days < 0
                  ? "font-medium text-destructive"
                  : days <= 30
                    ? "font-medium text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground";

            return (
              <tr key={row.registration_number} className="border-t border-border/50">
                <td className="px-4 py-2 font-medium tabular-nums">
                  {row.registration_number}
                </td>
                <td className="px-4 py-2">{row.model_name ?? "—"}</td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">
                  {row.pkk_last_date ? formatDate(row.pkk_last_date) : "—"}
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {row.pkk_next_deadline ? formatDate(row.pkk_next_deadline) : "—"}
                </td>
                <td className={cn("px-4 py-2 text-right tabular-nums", statusClass)}>
                  {days == null
                    ? "—"
                    : days < 0
                      ? `${formatNumber(Math.abs(days))} d. forfalt`
                      : days === 0
                        ? "I dag"
                        : `${formatNumber(days)} d.`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CustomerRow({
  customer,
  filters,
  notes,
  expanded,
  onToggle,
}: {
  customer: PkkCustomerRow;
  filters: PkkFilters;
  notes: PkkCustomerNotesMap;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [vehicles, setVehicles] = useState<PkkOwnerVehicleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priority = getPkkPriority(customer);
  const savedNote = notes[customer.owner_key] ?? { contactEmail: "", note: "" };
  const hasContact = Boolean(savedNote.contactEmail || savedNote.note);

  function handleToggle() {
    const willExpand = !expanded;
    onToggle();
    if (!willExpand || vehicles != null) return;

    startTransition(async () => {
      const result = await fetchPkkOwnerVehicles(filters, customer.owner_key);
      setVehicles(result.vehicles);
      setError(result.error ?? null);
    });
  }

  return (
    <>
      <tr
        className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40"
        onClick={handleToggle}
      >
        <td className="py-3 pr-2 pl-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="py-3 pr-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <div
              className={cn(
                "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold",
                PKK_PRIORITY_CLASSES[priority],
              )}
            >
              {PKK_PRIORITY_LABELS[priority]}
            </div>
            {hasContact ? (
              <Badge variant="outline" className="text-xs font-normal">
                Notat
              </Badge>
            ) : null}
          </div>
          <div className="font-medium">{customer.owner_name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {[customer.owner_orgnr, customer.owner_location]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
        </td>
        <td className="py-3 pr-3 text-muted-foreground">
          {customer.sales_region != null
            ? getRegionLabel(customer.sales_region)
            : "—"}
        </td>
        <td className="py-3 pr-3 text-right tabular-nums">
          {formatNumber(customer.focus_count)}
        </td>
        <td className="py-3 pr-3 text-right tabular-nums">
          {customer.overdue_count > 0 ? (
            <span className="font-semibold text-destructive">
              {formatNumber(customer.overdue_count)}
            </span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </td>
        <td className="py-3 pr-3 text-right tabular-nums">
          {customer.due_30_count > 0 ? (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {formatNumber(customer.due_30_count)}
            </span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </td>
        <td className="py-3 pr-3 text-right tabular-nums text-muted-foreground">
          {formatNumber(customer.due_90_count)}
        </td>
        <td className="py-3 pr-4 text-right text-sm tabular-nums">
          {formatDeadline(customer.next_deadline, customer.days_to_next)}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-border/60">
          <td colSpan={8} className="p-0">
            <PkkCustomerContact
              ownerKey={customer.owner_key}
              initialNote={savedNote}
            />
            {isPending ? (
              <div className="flex items-center gap-2 border-t border-border px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Henter kjøretøy …
              </div>
            ) : error ? (
              <p className="border-t border-border px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : (
              <VehicleSubTable rows={vehicles ?? []} />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function PkkCustomerTable({
  customers,
  filters,
  notes,
}: {
  customers: PkkCustomerRow[];
  filters: PkkFilters;
  notes: PkkCustomerNotesMap;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (customers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {filters.customerSearch
          ? `Ingen kunder matcher «${filters.customerSearch}» med valgte filtre.`
          : filters.onlyFollowUp
            ? "Ingen kunder trenger oppfølging med valgte filtre."
            : "Ingen storkunder matcher filteret. Prøv lavere min. antall kjøretøy eller annen region."}
      </p>
    );
  }

  const actionCount = customers.filter(customerNeedsFollowUp).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {formatNumber(customers.length)} kunder ·{" "}
          <span className="font-medium text-foreground">
            {formatNumber(actionCount)} trenger oppfølging
          </span>
        </p>
        <Badge variant="outline">Sortert etter prioritet</Badge>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left text-muted-foreground">
              <th className="w-8 py-3 pl-3" aria-label="Utvid" />
              <th className="py-3 pr-3 font-medium">Kunde</th>
              <th className="py-3 pr-3 font-medium">Region</th>
              <th className="py-3 pr-3 text-right font-medium">Flåte</th>
              <th className="py-3 pr-3 text-right font-medium">Forfalt ≤ 90 d.</th>
              <th className="py-3 pr-3 text-right font-medium">≤ 30 d.</th>
              <th className="py-3 pr-3 text-right font-medium">≤ 90 d.</th>
              <th className="py-3 pr-4 text-right font-medium">Nærmeste frist</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <CustomerRow
                key={customer.owner_key}
                customer={customer}
                filters={filters}
                notes={notes}
                expanded={expandedKey === customer.owner_key}
                onToggle={() =>
                  setExpandedKey((prev) =>
                    prev === customer.owner_key ? null : customer.owner_key,
                  )
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
