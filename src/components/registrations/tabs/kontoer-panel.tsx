import { AlarmClock, ArrowLeftRight, Clock3, Users } from "lucide-react";

import { MetricCards } from "@/components/kpi/metric-cards";
import { KontoerFinanceFilter } from "@/components/registrations/kontoer-finance-filter";
import { OwnerDeclineTable } from "@/components/registrations/owner-decline-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { getKontoerTabData } from "@/lib/registrations/kontoer-queries";

export async function KontoerPanel({
  filters,
  focusMake,
  excludeFinance = true,
}: {
  filters: RegistrationsFilters;
  focusMake: string;
  excludeFinance?: boolean;
}) {
  const data = await getKontoerTabData(filters, focusMake, excludeFinance);
  const { summary, rows, currentPeriod, lookbackStart } = data;
  const competitorBuyers =
    summary.competitorOnlyOwners + summary.mixedOwners;

  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente kundeutvikling: {data.error}
        </p>
      ) : null}

      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Periode:</span>{" "}
        {formatDate(currentPeriod.from)}–{formatDate(currentPeriod.to)}{" "}
        (konkurrentkjøp).{" "}
        <span className="font-medium text-foreground">Kundebase:</span>{" "}
        {focusMake}-kjøp fra {formatDate(lookbackStart)} (ca. 10 år). Byttesyklus
        3–5 år: forfaller (3–5), forfalt (5+). «Kun konkurrent» = 0{" "}
        {focusMake} i perioden; «Også konkurrent» = både {focusMake} og andre.
        {excludeFinance
          ? " Finans, leasing og merkeimportører er skjult."
          : " Finans og leasing er inkludert."}
      </p>

      <KontoerFinanceFilter />

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
            },
            {
              key: "competitor",
              title: "Kjøpt konkurrent",
              value: formatNumber(competitorBuyers),
              description: `${formatNumber(summary.competitorOnlyOwners)} kun konkurrent · ${formatNumber(summary.mixedOwners)} også ${focusMake}`,
              icon: ArrowLeftRight,
              footnote: "I valgt periode",
            },
            {
              key: "due",
              title: "Forfaller",
              value: formatNumber(summary.dueOwners),
              description: "3–5 år siden siste fokusmerke-kjøp",
              icon: Clock3,
              footnote: "I byttevindu",
            },
            {
              key: "overdue",
              title: "Forfalt",
              value: formatNumber(summary.overdueOwners),
              description: "Over 5 år siden siste fokusmerke-kjøp",
              icon: AlarmClock,
              footnote: "Risiko for tapt konto",
            },
          ]}
        />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prioriterte kontoer</CardTitle>
            <CardDescription>
              Konkurrentkjøp i perioden, eller ≥3 år siden siste {focusMake}.
              «Kun konkurrent» rangeres foran blandede kjøp og forfall.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OwnerDeclineTable rows={rows} focusMake={focusMake} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
