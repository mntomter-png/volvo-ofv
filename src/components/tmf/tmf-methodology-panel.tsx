import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TmfMethodologyPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metodikk</CardTitle>
        <CardDescription>
          Slik beregnes TMF-prognosen og hvordan resultatene skal tolkes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <section className="space-y-2">
          <h3 className="font-semibold">Prognoseformel</h3>
          <p className="text-muted-foreground">
            Årlig markedsprognose per segment beregnes som:
          </p>
          <p className="rounded-md border border-border/60 bg-muted/40 px-4 py-3 font-mono text-xs">
            Prognose = Baseline × Sesong × SSB-driver × Scenario × Analytikerjustering
          </p>
          <p className="text-muted-foreground">
            Volvo-estimat = TMF × markedsandel (rullerende 12 mnd, eller overstyrt av
            analytiker).
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Komponenter</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-medium">Baseline</dt>
              <dd className="text-muted-foreground">
                Gjennomsnittlig månedlig volum basert på rullerende 12 måneder med
                fullførte data.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Sesong</dt>
              <dd className="text-muted-foreground">
                Månedlige faktorer kalibrert mot de siste 5 fullførte kalenderårene.
              </dd>
            </div>
            <div>
              <dt className="font-medium">SSB-driver</dt>
              <dd className="text-muted-foreground">
                YoY-endring fra SSB-indikatorer, nedtonet 50 % og begrenset til ±15 %.
                Gruppert etter påbygg-segment.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Scenario</dt>
              <dd className="text-muted-foreground">
                Basis, optimistisk eller konservativ justering av drivereffekten.
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Datagrunnlag</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>OFV nyregistreringer, N3 ≥16 tonn, fra januar 2020.</li>
            <li>SSB-indikatorer for godstransport, bygg- og anleggsaktivitet, og makro.</li>
            <li>Segmentering etter påbygg: Anlegg, Distribusjon, Langtransport, Annet.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Begrensninger</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Ingen trendprojeksjon — baseline speiler nivået de siste 12 månedene, ikke
              langsiktig vekst eller nedgang.
            </li>
            <li>
              SSB-drivere bruker dagens indeksverdi; historiske SSB-øyeblikksbilder er
              ikke lagret for ekte punkt-i-tid-backtest.
            </li>
            <li>
              Volvo-estimat er mekanisk (TMF × andel) og fanger ikke konkurranseendringer
              eller produktlanseringer.
            </li>
            <li>
              Begrenset historikk (fra 2020) gir kortere sesongkalibrering og færre
              backtest-år enn ideelt.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Tolking av backtest</h3>
          <p className="text-muted-foreground">
            MAPE (Mean Absolute Percentage Error) måler gjennomsnittlig absolutt avvik
            mellom prognose og faktisk årsvolum. Under 10 % regnes som godt for
            markedsprognoser på segmentnivå; 10–20 % er akseptabelt gitt kort historikk.
            Positiv bias betyr systematisk overestimering.
          </p>
          <p className="text-muted-foreground">
            OFV-kjerne (uten SSB) isolerer baseline og sesong. Full modell inkluderer
            SSB, men bør tolkes med forsiktighet inntil historiske driververdier er
            tilgjengelige.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
