import { TrendingDown, Users, Warehouse } from "lucide-react";

import { MetricCards } from "@/components/kpi/metric-cards";
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
}: {
  filters: RegistrationsFilters;
  focusMake: string;
}) {
  const data = await getKontoerTabData(filters, focusMake);
  const { summary, rows, currentPeriod, priorPeriod } = data;

  const declineRate =
    summary.priorFocusOwners > 0
      ? (summary.decliningOwners / summary.priorFocusOwners) * 100
      : 0;

  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente kontorisiko: {data.error}
        </p>
      ) : null}

      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Nåværende:</span>{" "}
        {formatDate(currentPeriod.from)}–{formatDate(currentPeriod.to)}.{" "}
        <span className="font-medium text-foreground">Sammenlignes mot:</span>{" "}
        {formatDate(priorPeriod.from)}–{formatDate(priorPeriod.to)}. Måler{" "}
        {focusMake}-volum per eier (orgnr/navn). Regionfilter snevrer til ditt
        område. Månedfilter påvirker ikke denne fanen.
      </p>

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
              key: "base",
              title: `Tidligere ${focusMake}-kjøpere`,
              value: formatNumber(summary.priorFocusOwners),
              description: "Eiere med minst 1 kjøp i sammenligningsperioden",
              icon: Warehouse,
              footnote: "Utgangspunkt for risikolisten",
            },
          ]}
        />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risikoliste</CardTitle>
            <CardDescription>
              Topp 25 eiere med størst fall i {focusMake}-volum. Sortert etter
              absolutte enheter tapt. Finans-/leasingselskaper kan dominere
              listen — fase 2 kan filtrere dem bort.
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
