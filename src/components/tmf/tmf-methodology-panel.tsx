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
          Slik beregnes TMF-prognosen for OFV-markedspotensial, og hvordan tallene skal tolkes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <section className="space-y-2">
          <h3 className="font-semibold">Prognoseformel</h3>
          <p className="text-muted-foreground">
            Årlig markedsprognose per segment (neste år) beregnes som:
          </p>
          <p className="rounded-md border border-border/60 bg-muted/40 px-4 py-3 font-mono text-xs">
            Prognose = Baseline × Trend × Sesong × SSB-driver × Scenario × Analytikerjustering
          </p>
          <p className="text-muted-foreground">
            Volvo-estimat = TMF × markedsandel (rullerende 12 mnd, eller overstyrt av
            analytiker). Scope: OFV nyregistreringer N3 ≥16t — ikke leveranser.
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
              <dt className="font-medium">Trend</dt>
              <dd className="text-muted-foreground">
                Blend av historisk CAGR (opptil 3 fullførte år) og YTD-momentum (YoY for
                fullførte måneder i år). YTD-vekt øker med antall måneder (maks 65 %). Begge
                begrenses til ±10 %. Kun for neste års estimat.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Trendvekt (kalibrert)</dt>
              <dd className="text-muted-foreground">
                Hvor mye av trendutslaget som slippes gjennom, valgt av backtesten blant
                0 / 0,25 / 0,5 / 0,75 / 1. Lander den på 0, betyr det at trendekstrapolering
                historisk har økt prognosefeilen — da hviler prognosen på baseline, sesong
                og scenario, og den målte trenden vises kun som informasjon.
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
                YoY fra SSB (samme periode i fjor), med automatisk kalibrert signalvekt
                (testes 0.3–0.7) og clamp ±12 %. Rente er invertert. Velges for lavest
                historisk MAPE.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Makro over alle segmenter</dt>
              <dd className="text-muted-foreground">
                Makroindeksen (BNP, investering, olje/rør, rente) legges geometrisk over
                segmentets egen driverindeks med kalibrert makrovekt (testes 0–0.45), fordi
                rente og BNP treffer flåtefornyelse i alle segmenter. «Annet» bruker makro
                direkte og blandes ikke.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Scenario</dt>
              <dd className="text-muted-foreground">
                Basis, optimistisk eller konservativ justering av drivereffekten.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Volvo-estimat</dt>
              <dd className="text-muted-foreground">
                TMF × markedsandel. Andelen blander rullerende 12 mnd med andelen YTD i år,
                med samme vekt som volumtrenden (maks 65 % YTD), slik at et raskt skifte i
                andel ikke blir liggende igjen i trailing-vinduet. Overstyres av analytiker.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Drivlinje (ICE / EMOB)</dt>
              <dd className="text-muted-foreground">
                Mekanisk split av TMF-volum: EMOB-andel = trailing 12 mnd (fuel_name
                elektrisk). ICE = resten. Endrer ikke totalt markedspotensial.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Usikkerhet (P10/P50/P90)</dt>
              <dd className="text-muted-foreground">
                P50 = valgt scenario. Båndet er asymmetrisk: nedsiden er snittet av årene
                prognosen var for høy, oppsiden av årene den var for lav — hentet fra
                backtesten av modellen som faktisk leveres, og utvidet med scenariospennet.
                Beregnes både totalt og per segment.
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Datagrunnlag</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>OFV nyregistreringer, N3 ≥16 tonn, fra januar 2020 (markedspotensial).</li>
            <li>
              SSB-indikatorer for godstransport, bygg/anlegg, grensehandel og makro (BNP
              Fastlands-Norge, bruttoinvestering, olje/rør, styringsrente).
            </li>
            <li>Segmentering etter påbygg: Anlegg, Distribusjon, Langtransport, Annet.</li>
            <li>Interne leveransetall er utenfor scope i v1 og kan legges på senere.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Begrensninger</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Scope er registreringer (markedspotensial), ikke leveranser eller orderbook.
            </li>
            <li>
              Backtesten bruker dagens SSB-verdier, ikke hva vi visste da prognosen ble
              laget. SSB-bidraget ser derfor litt bedre ut enn det er. Vi lagrer nå
              månedlige SSB-øyeblikksbilder, så ekte punkt-i-tid-backtest blir mulig når
              vi har et års historikk.
            </li>
            <li>
              Volvo-estimat er mekanisk (TMF × andel) og fanger ikke konkurranseendringer
              eller produktlanseringer.
            </li>
            <li>
              Begrenset historikk (fra 2020) gir kortere sesongkalibrering og bare fire
              backtest-år. Nedside/oppside-båndene hviler dermed på få observasjoner.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Tolking av backtest og bånd</h3>
          <p className="text-muted-foreground">
            Backtesten simuleres fra samme måned året før målåret som den levende prognosen
            lages i. Det er strengere enn å simulere fra 1. januar i målåret, men det er den
            eneste sammenligningen som faktisk måler modellen vi leverer — inkludert
            trend/YTD, som ellers aldri blir aktivert.
          </p>
          <p className="text-muted-foreground">
            MAPE måler gjennomsnittlig absolutt avvik mellom prognose og faktisk årsvolum.
            Under 10 % er godt; 10–20 % er akseptabelt gitt kort historikk. Signert avvik =
            (faktisk − prognose) / faktisk: negativt betyr at prognosen var for høy. P10–P90
            er beslutningsstøtte — ikke statistisk prediksjonsintervall.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
