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
    indicatorKey: "bygg_anlegg_produksjon",
    label: "Produksjonsindeks bygge- og anleggsvirksomhet",
    tableId: "13430",
    tmfDriver: "construction",
    unit: "indeks (2021=100)",
    periodType: "monthly",
    timeDimension: "Tid",
    // NACE F = «Bygge- og anleggsvirksomhet» (SN2007, aggregatet for 41–43).
    // ContentsCode Ukekorrigert = «Produksjonsindeks. Kalenderjustert».
    // Volumindeks basert på timeverk (2021=100); fanger ikke prisvekst.
    // Ny nøkkel, så månedstall ikke upsertes oppå årsradene for
    // bygg_anlegg_omsetning (tabell 12939, nominell omsetning).
    valuecodes: {
      NACE: "F",
      ContentsCode: "Ukekorrigert",
      Tid: "from(2015M01)",
    },
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

/**
 * Serier som kan ligge igjen i `ssb_indicators` etter et bevisst seriebrudd.
 * Synken upsert-er på (indicator_key, period) og sletter ingenting.
 * `bygg_anlegg_omsetning` er nominell årsomsetning (tabell 12939) og skal
 * ikke vises eller inngå i Anlegg sammen med den månedlige produksjonsindeksen.
 */
export const RETIRED_SSB_INDICATOR_KEYS = ["bygg_anlegg_omsetning"] as const;

export function isRetiredSsbIndicatorKey(indicatorKey: string): boolean {
  return (RETIRED_SSB_INDICATOR_KEYS as readonly string[]).includes(indicatorKey);
}

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
