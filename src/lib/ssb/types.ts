/** SSB PxWebApi v2 – json-stat2 dataset (subset brukt i parser). */

export interface JsonStat2Dimension {
  label: string;
  category: {
    index: Record<string, number>;
    label: Record<string, string>;
  };
}

export interface JsonStat2Dataset {
  version: string;
  class: string;
  label?: string;
  updated?: string;
  id: string[];
  size: number[];
  dimension: Record<string, JsonStat2Dimension>;
  value?: (number | null)[];
}

export interface JsonStat2FlatRow {
  dimensions: Record<string, string>;
  dimensionLabels: Record<string, string>;
  value: number | null;
}

export type TmfDriver = "construction" | "distribution" | "long_haul" | "macro";

export type SsbPeriodType = "monthly" | "quarterly" | "annual";

export interface SsbIndicatorSource {
  /** Unik nøkkel lagret i ssb_indicators.indicator_key. */
  indicatorKey: string;
  label: string;
  tableId: string;
  tmfDriver: TmfDriver;
  unit: string;
  periodType: SsbPeriodType;
  /** Tid-dimensjon i tabellen (f.eks. Tid, Kvartal). */
  timeDimension: string;
  /** valuecodes sendt til PxWebApi v2. */
  valuecodes: Record<string, string>;
  /**
   * Når flere rader returneres (f.eks. import/eksport), bygg nøkkel fra disse
   * dimensjonene: indicatorKey + '_' + dimCode.
   */
  seriesDimension?: string;
  seriesLabelDimension?: string;
  /**
   * Når true, snus YoY-signatet (f.eks. høyere rente → lavere etterspørsel).
   * Gjelder driverindeks og UI-endring, ikke lagret råverdi.
   */
  invertSignal?: boolean;
}

export interface SsbIndicatorRow {
  indicator_key: string;
  label: string;
  period: string;
  value: number;
  unit: string | null;
  tmf_driver: TmfDriver;
  ssb_table_id: string;
}

export interface SsbSyncResult {
  skipped: boolean;
  reason?: string;
  indicators?: { fetched: number; upserted: number };
}
