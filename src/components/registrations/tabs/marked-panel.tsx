import { CompetitorSegmentBoard } from "@/components/registrations/competitor-segment-board";
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
import { focusShareHeadline } from "@/lib/registrations/competitor-segments";
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
  const headline = focusShareHeadline(data.competitorsBySegment, focusMake);

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
                : "Konkurrenter per segment"}
            </CardTitle>
            <CardDescription>
              {filters.pabygg
                ? `Toppmerker per måned i ${getPabyggSegmentLabel(filters.pabygg)}. Følger øvrige filtre.`
                : data.comparisonLabel
                  ? `Andel og antall per merke, og endring i prosentpoeng mot ${data.comparisonLabel}. Følger år, periode, region og øvrige filtre. Klikk et segment for månedlig utvikling.`
                  : "Andel og antall per merke i hvert påbygg-segment. Sammenligning med året før er ikke tilgjengelig for denne perioden. Klikk et segment for månedlig utvikling."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filters.pabygg ? (
              <StackedMakeChart
                data={data.makeCompetitionByMonth}
                layout="horizontal"
              />
            ) : (
              <CompetitorSegmentBoard
                segments={data.competitorsBySegment}
                focusName={focusMake}
                headline={headline}
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
