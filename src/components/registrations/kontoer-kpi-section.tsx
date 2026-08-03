"use client";

import { useState, useTransition } from "react";
import { AlarmClock, ArrowLeftRight, Clock3, Loader2, Users } from "lucide-react";

import { MetricCards } from "@/components/kpi/metric-cards";
import { OwnerDeclineTable } from "@/components/registrations/owner-decline-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { fetchKontoerOwners } from "@/lib/registrations/kontoer-actions";
import type {
  KontoerKpiBucket,
  OwnerFocusDeclineRow,
  OwnerFocusDeclineSummary,
} from "@/lib/registrations/kontoer-queries";

const BUCKET_TITLES: Record<Exclude<KontoerKpiBucket, "priority">, string> = {
  customers: "Volvo-kunder (10 år)",
  competitor: "Kjøpt konkurrent",
  due: "Forfaller",
  overdue: "Forfalt",
};

const BUCKET_DESCRIPTIONS: Record<
  Exclude<KontoerKpiBucket, "priority">,
  string
> = {
  customers: "Alle eiere med minst 2 kjøp siste 10 år.",
  competitor: "Kun konkurrent eller også Volvo i valgt periode.",
  due: "3–5 år siden siste fokusmerke-kjøp.",
  overdue: "Over 5 år siden siste fokusmerke-kjøp.",
};

export function KontoerKpiSection({
  summary,
  initialRows,
  filters,
  focusMake,
  excludeFinance,
  district = null,
}: {
  summary: OwnerFocusDeclineSummary;
  initialRows: OwnerFocusDeclineRow[];
  filters: RegistrationsFilters;
  focusMake: string;
  excludeFinance: boolean;
  district?: string | null;
}) {
  const [bucket, setBucket] = useState<KontoerKpiBucket>("priority");
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const competitorBuyers =
    summary.competitorOnlyOwners + summary.mixedOwners;

  function selectBucket(next: Exclude<KontoerKpiBucket, "priority">) {
    const target: KontoerKpiBucket = bucket === next ? "priority" : next;
    setBucket(target);
    setError(null);

    if (target === "priority") {
      setRows(initialRows);
      return;
    }

    startTransition(async () => {
      const result = await fetchKontoerOwners(
        filters,
        target,
        excludeFinance,
        district,
      );
      setRows(result.rows);
      setError(result.error ?? null);
    });
  }

  const listTitle =
    bucket === "priority"
      ? "Prioriterte kontoer"
      : BUCKET_TITLES[bucket].replace("Volvo", focusMake);

  const listDescription =
    bucket === "priority"
      ? `Konkurrentkjøp i perioden, eller ≥3 år siden siste ${focusMake}. Klikk et KPI-kort for å se hele gruppen.`
      : BUCKET_DESCRIPTIONS[bucket].replace("Volvo", focusMake);

  return (
    <>
      <section className="mb-6">
        <MetricCards
          cards={[
            {
              key: "customers",
              title: `${focusMake}-kunder (10 år)`,
              value: formatNumber(summary.customers10y),
              description: `Minst 2 ${focusMake}-kjøp siste 10 år`,
              icon: Users,
              footnote: "Utgangspunkt for oppfølging",
              selected: bucket === "customers",
              onClick: () => selectBucket("customers"),
            },
            {
              key: "competitor",
              title: "Kjøpt konkurrent",
              value: formatNumber(competitorBuyers),
              description: `${formatNumber(summary.competitorOnlyOwners)} kun konkurrent · ${formatNumber(summary.mixedOwners)} også ${focusMake}`,
              icon: ArrowLeftRight,
              footnote: "I valgt periode",
              selected: bucket === "competitor",
              onClick: () => selectBucket("competitor"),
            },
            {
              key: "due",
              title: "Forfaller",
              value: formatNumber(summary.dueOwners),
              description: "3–5 år siden siste fokusmerke-kjøp",
              icon: Clock3,
              footnote: "I byttevindu",
              selected: bucket === "due",
              onClick: () => selectBucket("due"),
            },
            {
              key: "overdue",
              title: "Forfalt",
              value: formatNumber(summary.overdueOwners),
              description: "Over 5 år siden siste fokusmerke-kjøp",
              icon: AlarmClock,
              footnote: "Risiko for tapt konto",
              selected: bucket === "overdue",
              onClick: () => selectBucket("overdue"),
            },
          ]}
        />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{listTitle}</CardTitle>
            <CardDescription>{listDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Henter kontoer…
              </p>
            ) : null}
            {error ? (
              <p className="mb-3 text-sm text-destructive">{error}</p>
            ) : null}
            {!isPending ? (
              <OwnerDeclineTable rows={rows} focusMake={focusMake} />
            ) : null}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
