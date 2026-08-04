/** Narrativ fra Informasjonsmøte juli 2026 — beholdes som kontekst rundt live OFV-tall. */

export const PRESENTATION_META = {
  title: "Informasjonsmøte",
  subtitle: "Live OFV-tall med innsikt fra juli 2026",
  sourceNote: "Kilde: OFV · Tunge nyregistreringer ≥ 16 t",
  narrativeOrigin: "Narrativ basert på Informasjonsmøte juli 2026",
} as const;

export interface SlideNarrative {
  id: string;
  title: string;
  bullets: string[];
}

export const SLIDE_NARRATIVES: SlideNarrative[] = [
  {
    id: "title",
    title: "Informasjonsmøte",
    bullets: [],
  },
  {
    id: "market-volume",
    title: "Rundt 4000 marked også i 2026",
    bullets: [
      "2019 var toppåret før pandemien trakk markedet ned mot ~4 000.",
      "2023–2024 ga to sterke år, drevet av etterslep og anlegg.",
      "2025 falt – renterespons og avventende transportkjøpere.",
      "Inneværende år viser årstakt som indikerer moderat rebound.",
    ],
  },
  {
    id: "make-share",
    title: "Et herlig comeback etter målrettet salgsarbeid",
    bullets: [
      "Scania toppet i 2025; Volvo svarer sterkt i inneværende år.",
      "MB og MAN har mistet andel siden 2019 – men er på vei tilbake via elektrisk.",
    ],
  },
  {
    id: "segments",
    title: "Fortsatt stort potensial i de fleste segmenter",
    bullets: [
      "Styrke: anleggssegmentene (tipp/kran) er hjemmebane.",
      "Størst potensial: krokløft og renovasjon – drivlinjeomstilling deler kortene på nytt.",
      "Trekkvogn er markedets største segment og det viktigste volumgapet å lukke.",
    ],
  },
  {
    id: "driveline",
    title: "Dekarboniseringen fortsetter og BEV vokser raskt",
    bullets: [
      "Diesel samlet inkluderer alle dieselvarianter.",
      "Fossilfri andel (el + gass) øker i inneværende periode.",
    ],
  },
  {
    id: "bev-segments",
    title: "Elektriske biler i alle segmenter",
    bullets: [
      "Skap (inkl. kjøl/frys) er det klart mest elektrifiserte segmentet.",
      "Anlegg følger: tipp og kran drives av utslippsfrie byggeplasskrav.",
      "Trekkvogn henger etter – ladeinfrastruktur er fortsatt flaskehals.",
    ],
  },
  {
    id: "gas",
    title: "Renovasjonsmarkedet er overinvestert i gass",
    bullets: [
      "Renovasjon er gassens hjemmebane – biogass gir sirkulær logikk.",
      "Konteiner og skap bruker gass der el ennå ikke dekker rekkevidden.",
      "I gassmarkedet er det jevnt løp mellom Scania og Volvo.",
    ],
  },
  {
    id: "bev-competition",
    title: "Konkurransen er reell på BEV",
    bullets: [
      "Utfordrerne kommer via skap-segmentet.",
      "MAN og MB angriper der de historisk står sterkest.",
      "Volvos el-festninger er anlegg og kommunale segmenter.",
    ],
  },
];
