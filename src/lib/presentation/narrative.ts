/** Presentasjonsmeta og nøytrale slide-titler. Innsiktspunkter bygges live i live-narrative.ts. */

export const PRESENTATION_META = {
  title: "Informasjonsmøte",
  subtitle: "Markedsoversikt basert på live OFV-tall",
  sourceNote: "Kilde: OFV · Tunge nyregistreringer ≥ 16 t",
  narrativeOrigin: "Tekst generert fra live tall (nøytral)",
} as const;

export interface SlideNarrative {
  id: string;
  title: string;
  bullets: string[];
}

/** Faste, nøytrale titler — punktene fylles med live data. */
export const SLIDE_TITLES: { id: string; title: string }[] = [
  { id: "title", title: "Informasjonsmøte" },
  { id: "market-volume", title: "Markedsvolum over tid" },
  { id: "make-share", title: "Markedsandel per merke" },
  { id: "segments", title: "Andel per påbyggsegment" },
  { id: "driveline", title: "Drivlinjefordeling" },
  { id: "bev-segments", title: "Elektrisk andel per segment" },
  { id: "gas", title: "Gassandel per segment" },
  { id: "bev-competition", title: "Elektrisk volum og merkeandel" },
];
