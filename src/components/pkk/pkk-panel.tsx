"use client";

import { PkkCustomerTable } from "@/components/pkk/pkk-customer-table";
import { PkkKpiCards } from "@/components/pkk/pkk-kpi-cards";
import { ExportExcelButton } from "@/components/export/export-excel-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pkkFiltersToParams, type PkkFilters } from "@/lib/pkk/filters";
import type { PkkCustomerNotesMap } from "@/lib/pkk/note-actions";
import type { PkkPageData } from "@/lib/pkk/queries";

export function PkkPanel({
  data,
  filters,
  notes,
  shortName,
}: {
  data: PkkPageData;
  filters: PkkFilters;
  notes: PkkCustomerNotesMap;
  shortName: string;
}) {
  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente PKK-data: {data.error}
        </p>
      ) : null}

      {!data.hasPkkDates ? (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          PKK-datoer er ikke synket fra OFV ennå. KPI-er og frister fylles når
          kontrolldata er tilgjengelig i bestand.
        </p>
      ) : null}

      <section className="mb-6">
        <PkkKpiCards summary={data.summary} />
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Prioritert kundeliste</CardTitle>
              <CardDescription>
                Storkunder med flest {shortName}-kjøretøy, rangert etter PKK-prioritet.
                Utvid for kontaktinfo, notat og kjøretøy med frist innen 6 måneder.
              </CardDescription>
            </div>
            <ExportExcelButton
              endpoint="/api/export/pkk"
              params={pkkFiltersToParams(filters)}
              label="Eksporter Excel"
            />
          </CardHeader>
          <CardContent>
            <PkkCustomerTable
              customers={data.customers}
              filters={filters}
              notes={notes}
            />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
