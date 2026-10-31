import type { SsbIndicatorSource, TmfDriver } from "@/lib/ssb/types";

/** Norske visningsnavn for TMF-drivere. */
export const TMF_DRIVER_LABELS: Record<TmfDriver, string> = {
  construction: "Anlegg",
  distribution: "Distribusjon",
  long_haul: "Langtransport",
  macro: "Makro",
};

/**
 * SSB-tabeller og filtre brukt som etterspørselsdrivere i TMF.
 * Tid-intervall hentes fra 2015 for kvartalsdata og 2015 for årsdata.
 */
export const SSB_INDICATOR_SOURCES: readonly SsbIndicatorSource[] = [
  {
    indicatorKey: "godstrans_masse_transportmengde",
    label: "Massetransport (stein, grus, sand m.m.)",
    tableId: "06988",
    tmfDriver: "construction",
    unit: "mill. tonn",
    periodType: "quarterly",
    timeDimension: "Tid",
    valuecodes: {
      Vareslag: "23",
      ContentsCode: "TranspMengd",
      Tid: "from(2015K1)",
    },
  },
  {
    indicatorKey: "godstrans_stykkgods_transportmengde",
    label: "Stykkgods-transport",
    tableId: "06988",
    tmfDriver: "distribution",
    unit: "mill. tonn",
    periodType: "quarterly",
    timeDimension: "Tid",
    valuecodes: {
      Vareslag: "24",
      ContentsCode: "TranspMengd",
      Tid: "from(2015K1)",
    },
  },
  {
    indicatorKey: "godstrans_veitransport_godsmengde",
    label: "Innenlandsk godstransport på vei",
    tableId: "11403",
    tmfDriver: "distribution",
    unit: "mill. tonn",
    periodType: "annual",
    timeDimension: "Tid",
    valuecodes: {
      Godstransport: "10",
      ContentsCode: "Godsmengde",
      Tid: "from(2015)",
    },
  },
  {
    indicatorKey: "bygg_anlegg_omsetning",
    label: "Omsetning bygge- og anleggsvirksomhet",
    tableId: "12939",
    tmfDriver: "construction",
    unit: "mill. kr",
    periodType: "annual",
    timeDimension: "Tid",
    valuecodes: {
      NACE2007: "41-43",
      Enhet: "1",
      ContentsCode: "Oms",
      Tid: "from(2017)",
    },
    // Tabell 12939 er strukturstatistikk (hovedtall), ikke den avviklede
    // kortsiktige omsetningsstatistikken. SSB oppdaterte tabellen 7. mai 2026;
    // tittelen er 2017–2024, så 2024 er nyeste publiserte år. Produksjonsindeksen
    // (tabell 13430) måler timeverk (2021=100) og er et annet mål — ikke en
    // erstatning for omsetning i mill. kr. Serien beholdes, og UI-et advarer
    // når den ligger klart bak de andre indikatorene.
    stalenessNote:
      "SSB-tabell 12939 er ikke avviklet. Den er årsvis strukturstatistikk for omsetning i mill. kr, sist oppdatert 7. mai 2026, og nyeste publiserte år er 2024. Produksjonsindeksen i tabell 13430 måler timeverk og er ikke en erstatningsserie.",
  },
  {
    indicatorKey: "investering_bygg_anlegg",
    label: "Bruttoinvestering bygge- og anleggsvirksomhet",
    tableId: "09181",
    tmfDriver: "construction",
    unit: "mill. kr",
    periodType: "annual",
    timeDimension: "Tid",
    valuecodes: {
      NACE: "pub2X41_43",
      ContentsCode: "BIF",
      Tid: "from(2015)",
    },
  },
  {
    indicatorKey: "godstrans_grense_norsk",
    label: "Godstransport over grensen (norske lastebiler)",
    tableId: "11682",
    tmfDriver: "long_haul",
    unit: "tonn",
    periodType: "quarterly",
    timeDimension: "Tid",
    valuecodes: {
      ImpEks: "*",
      Vareslag: "TOT",
      LastebilNasjon: "NO",
      ContentsCode: "Mengde",
      Tid: "from(2015K1)",
    },
    seriesDimension: "ImpEks",
    seriesLabelDimension: "ImpEks",
  },
  {
    indicatorKey: "makro_hovedstorrelser",
    label: "Makroøkonomiske hovedstørrelser",
    tableId: "11721",
    tmfDriver: "macro",
    unit: "mill. kr",
    periodType: "monthly",
    timeDimension: "Tid",
    valuecodes: {
      Makrost: "bnpb.nr23_9fn,bif.nr83_6fn,bif.nr83oljroer",
      ContentsCode: "Faste",
      Tid: "from(2016M01)",
    },
    seriesDimension: "Makrost",
    seriesLabelDimension: "Makrost",
  },
  {
    indicatorKey: "makro_styringsrente",
    label: "Norges Banks styringsrente",
    tableId: "10701",
    tmfDriver: "macro",
    unit: "%",
    periodType: "monthly",
    timeDimension: "Tid",
    valuecodes: {
      RenterNbNibor: "02",
      ContentsCode: "Renter",
      Tid: "from(2015M01)",
    },
    invertSignal: true,
  },
] as const;

/** Finn kildekonfig for en lagret indikatornøkkel (inkl. series-suffiks). */
export function findSsbIndicatorSource(
  indicatorKey: string,
): (typeof SSB_INDICATOR_SOURCES)[number] | undefined {
  return SSB_INDICATOR_SOURCES.find(
    (source) =>
      source.indicatorKey === indicatorKey ||
      (source.seriesDimension != null &&
        indicatorKey.startsWith(`${source.indicatorKey}_`)),
  );
}

/** Unike API-kall (flere indikatorer kan dele samme tabell+filter). */
export function getUniqueSsbFetchRequests(): {
  tableId: string;
  valuecodes: Record<string, string>;
  sources: SsbIndicatorSource[];
}[] {
  const byKey = new Map<
    string,
    { tableId: string; valuecodes: Record<string, string>; sources: SsbIndicatorSource[] }
  >();

  for (const source of SSB_INDICATOR_SOURCES) {
    const key = `${source.tableId}:${JSON.stringify(source.valuecodes)}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.sources.push(source);
    } else {
      byKey.set(key, {
        tableId: source.tableId,
        valuecodes: source.valuecodes,
        sources: [source],
      });
    }
  }

  return [...byKey.values()];
}
