import { Percent, TrendingDown, Users, Warehouse } from "lucide-react";

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
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
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
  const { summary, rows, currentPeriod, priorPeriod } = data;

  const declineRate =
    summary.priorFocusOwners > 0
      ? (summary.decliningOwners / summary.priorFocusOwners) * 100
      : 0;

  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente kundeutvikling: {data.error}
        </p>
      ) : null}

      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Nåværende:</span>{" "}
        {formatDate(currentPeriod.from)}–{formatDate(currentPeriod.to)}.{" "}
        <span className="font-medium text-foreground">Sammenlignes mot:</span>{" "}
        {formatDate(priorPeriod.from)}–{formatDate(priorPeriod.to)}. Måler{" "}
        {focusMake}-volum og wallet-share per eier (orgnr/navn). Regionfilter
        snevrer til ditt område. Månedfilter påvirker ikke denne fanen.
        {excludeFinance
          ? " Finans, leasing og merkeimportører er skjult."
          : " Finans og leasing er inkludert."}
      </p>

      <KontoerFinanceFilter />

      <section className="mb-6">
        <MetricCards
          cards={[
            {
              key: "declining",
              title: "Eiere med fall",
              value: formatNumber(summary.decliningOwners),
              description: `Av ${formatNumber(summary.priorFocusOwners)} med ${focusMake} i fjor`,
              icon: Users,
              footnote: `${formatPercent(declineRate)} % av tidligere ${focusMake}-kjøpere`,
            },
            {
              key: "lost",
              title: "Tapt volum",
              value: formatNumber(summary.lostUnits),
              description: `${focusMake}-enheter færre enn samme periode i fjor`,
              icon: TrendingDown,
              footnote: "Sum av fall per eier (kun de som faller)",
            },
            {
              key: "share",
              title: "Snitt share-fall",
              value: `${formatPercent(summary.avgShareDropPp)} pp`,
              description: `${formatNumber(summary.shareDecliningOwners)} eiere med lavere wallet-share`,
              icon: Percent,
              footnote: `${focusMake}-andel av eierens totale kjøp`,
            },
            {
              key: "base",
              title: `Tidligere ${focusMake}-kjøpere`,
              value: formatNumber(summary.priorFocusOwners),
              description: "Eiere med minst 1 kjøp i sammenligningsperioden",
              icon: Warehouse,
              footnote: "Utgangspunkt for listen",
            },
          ]}
        />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prioriterte kontoer</CardTitle>
            <CardDescription>
              Topp 25 sortert på score (0–100): 40 % volumfall, 35 %
              wallet-share-fall, 25 % tid siden siste {focusMake}-kjøp. Hold
              over score for delkomponenter.
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
