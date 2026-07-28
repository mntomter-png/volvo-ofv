import { BreakdownTable } from "@/components/registrations/breakdown-table";
import { ElectricTrendChart } from "@/components/registrations/electric-trend-chart";
import { StackedMakeChart } from "@/components/registrations/stacked-make-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPabyggSegmentLabel } from "@/lib/ofv/segmentation";
import type { RegistrationsFilters } from "@/lib/registrations/filters";
import { getMarkedTabData } from "@/lib/registrations/queries";

export async function MarkedPanel({
  filters,
  focusMake,
}: {
  filters: RegistrationsFilters;
  focusMake: string;
}) {
  const data = await getMarkedTabData(filters, focusMake);

  return (
    <>
      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente markedsdata: {data.error}
        </p>
      ) : null}

      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filters.pabygg
                ? "Merkekonkurranse over tid"
                : "Påbygg-fordeling"}
            </CardTitle>
            <CardDescription>
              {filters.pabygg
                ? `Toppmerker per måned i ${getPabyggSegmentLabel(filters.pabygg)}. Følger øvrige filtre.`
                : "Basert på OFVs påbyggdata og Volvos påbygghierarki. Trekkbiler uten eget påbygg telles som Langtransport. Klikk for å filtrere."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filters.pabygg ? (
              <StackedMakeChart
                data={data.makeCompetitionByMonth}
                layout="horizontal"
              />
            ) : (
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
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Elektrifisering per påbygg</CardTitle>
            <CardDescription>
              Månedlig andel elektriske registreringer i Volvo-påbyggsegmentene.
              Følger øvrige filtre.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ElectricTrendChart series={data.electricTrend} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
