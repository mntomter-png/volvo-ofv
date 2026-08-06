import { BrandedMakeShareChart } from "@/components/dashboard/branded-make-share-chart";
import { BreakdownTable } from "@/components/registrations/breakdown-table";
import { MakeMonthIndicator } from "@/components/registrations/make-month-indicator";
import { RegistrationsMonthChart } from "@/components/registrations/registrations-month-chart";
import { RegistrationsSummaryCards } from "@/components/registrations/registrations-summary-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import type { RegistrationsPageData } from "@/lib/registrations/queries";

interface OversiktPanelProps {
  data: RegistrationsPageData;
  filters: RegistrationsFilters;
  year: number;
  activeMonthLabel: string | null;
  makeChartTotal: number;
  showDealerRegions: boolean;
}

export function OversiktPanel({
  data,
  filters,
  year,
  activeMonthLabel,
  makeChartTotal,
  showDealerRegions,
}: OversiktPanelProps) {
  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente data: {data.error}
        </p>
      ) : null}

      <section className="mb-6">
        <RegistrationsSummaryCards summary={data.summary} filters={filters} />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per måned</CardTitle>
            <CardDescription>
              Førstegangsregistrerte tunge lastebiler i {year}. %-sats = merkeandel
              for fokusert merke. Klikk på en måned for å filtrere
              merkefordelingen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationsMonthChart data={data.byMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Merkefordeling</CardTitle>
              {activeMonthLabel ? (
                <MakeMonthIndicator monthLabel={activeMonthLabel} />
              ) : null}
            </div>
            <CardDescription>
              {activeMonthLabel
                ? `Topp 10 merker i ${activeMonthLabel}`
                : "Topp 10 merker i filtrert utvalg"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandedMakeShareChart
              data={data.byMake}
              total={makeChartTotal}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segmenter (Volvo påbygg)</CardTitle>
            <CardDescription>
              Anlegg, Distribusjon, Langtransport og Annet – basert på OFVs
              påbyggkoder. Trekkbiler uten eget påbygg telles som Langtransport.
              Klikk for å filtrere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="pabygg"
              columnLabel="Påbygg"
              hint="Klikk på et påbygg-segment for å filtrere siden."
              data={data.byPabygg.map((row) => ({
                key: row.pabygg,
                label: row.label,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>

        {showDealerRegions ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regionfordeling</CardTitle>
              <CardDescription>
                Salgsregioner (Volvo-forhandlernett) basert på brukerens
                postnummer. Klikk på en region for å filtrere hele siden.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BreakdownTable
                queryKey="region"
                columnLabel="Region"
                hint="Klikk på en region for å filtrere siden."
                data={data.byRegion.map((row) => ({
                  key: String(row.region),
                  label: row.label,
                  count: row.count,
                  volvo_count: row.volvo_count,
                }))}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">HK-fordeling</CardTitle>
            <CardDescription>
              Effekt (HK) per bøtte. Elektriske/ukjente er utelatt. Klikk på en
              bøtte for å filtrere hele siden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="hp"
              columnLabel="HK"
              hint="Klikk på en HK-bøtte for å filtrere siden."
              data={data.byHp.map((row) => ({
                key: String(row.bucket),
                label: row.label,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Drivstoff-fordeling</CardTitle>
            <CardDescription>
              Drivlinje (diesel, elektrisk, gass). Klikk på et drivstoff for å
              filtrere hele siden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="fuel"
              columnLabel="Drivstoff"
              hint="Klikk på et drivstoff for å filtrere siden."
              data={data.byFuel.map((row) => ({
                key: row.fuel,
                label: row.fuel,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Slagvolum-fordeling</CardTitle>
            <CardDescription>
              Motorstørrelse (9L / 11L / 13L / ≥16L / elektrisk). «Ukjent» = CC
              ikke oppgitt i OFV (typisk enkelte gassbiler). Klikk for å
              filtrere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="disp"
              columnLabel="Slagvolum"
              hint="Klikk på en bøtte for å filtrere siden."
              data={data.byDisp.map((row) => ({
                key: String(row.bucket),
                label: row.label,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader>
            <CardTitle className="text-base">Påbygg-koder</CardTitle>
            <CardDescription>
              OFV AdditionalBodyworks (skap, tipp, krok, …). Kjøretøy uten
              påbygg-kode vises som «Uten påbygg». Klikk for å filtrere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable
              queryKey="bodywork"
              columnLabel="Påbygg-kode"
              hint="Klikk på en påbygg-kode for å filtrere siden."
              scrollable
              data={data.byBodywork.map((row) => ({
                key: String(row.bodywork),
                label: row.label,
                count: row.count,
                volvo_count: row.volvo_count,
              }))}
            />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
