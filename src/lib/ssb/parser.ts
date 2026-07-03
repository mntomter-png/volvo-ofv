import type {
  JsonStat2Dataset,
  JsonStat2FlatRow,
  SsbIndicatorRow,
  SsbIndicatorSource,
} from "@/lib/ssb/types";

function orderedDimensionCodes(dataset: JsonStat2Dataset, dimensionId: string): string[] {
  const dim = dataset.dimension[dimensionId];
  if (!dim) return [];

  return Object.entries(dim.category.index)
    .sort((a, b) => a[1] - b[1])
    .map(([code]) => code);
}

/** Flater ut json-stat2 til én rad per kombinasjon av dimensjoner. */
export function flattenJsonStat2(dataset: JsonStat2Dataset): JsonStat2FlatRow[] {
  const dimensionIds = dataset.id;
  const dimensions = dataset.dimension;
  const values = dataset.value ?? [];

  const codesByDimension = dimensionIds.map((id) => orderedDimensionCodes(dataset, id));
  const labelsByDimension: Record<string, Record<string, string>> = {};
  for (const id of dimensionIds) {
    labelsByDimension[id] = dimensions[id]?.category.label ?? {};
  }

  const rows: JsonStat2FlatRow[] = [];
  let valueIndex = 0;

  function walk(dimIndex: number, current: Record<string, string>): void {
    if (dimIndex === dimensionIds.length) {
      const raw = values[valueIndex];
      valueIndex += 1;
      rows.push({
        dimensions: { ...current },
        dimensionLabels: Object.fromEntries(
          Object.entries(current).map(([key, code]) => [
            key,
            labelsByDimension[key]?.[code] ?? code,
          ]),
        ),
        value: typeof raw === "number" && Number.isFinite(raw) ? raw : null,
      });
      return;
    }

    const dimId = dimensionIds[dimIndex];
    if (!dimId) return;

    const codes = codesByDimension[dimIndex];
    if (!codes) return;

    for (const code of codes) {
      current[dimId] = code;
      walk(dimIndex + 1, current);
    }
  }

  walk(0, {});
  return rows;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Ekstraher indikatorrader fra et SSB-dataset basert på kildekonfigurasjon. */
export function extractIndicatorRows(
  dataset: JsonStat2Dataset,
  source: SsbIndicatorSource,
): SsbIndicatorRow[] {
  const flatRows = flattenJsonStat2(dataset);
  const rows: SsbIndicatorRow[] = [];

  for (const row of flatRows) {
    if (row.value == null) continue;

    const period = row.dimensions[source.timeDimension];
    if (!period) continue;

    let indicatorKey = source.indicatorKey;
    let label = source.label;

    if (source.seriesDimension) {
      const seriesCode = row.dimensions[source.seriesDimension];
      if (!seriesCode) continue;
      indicatorKey = `${source.indicatorKey}_${slugify(seriesCode)}`;
      const seriesLabel =
        row.dimensionLabels[source.seriesLabelDimension ?? source.seriesDimension];
      label = `${source.label} – ${seriesLabel}`;
    }

    rows.push({
      indicator_key: indicatorKey,
      label,
      period,
      value: row.value,
      unit: source.unit,
      tmf_driver: source.tmfDriver,
      ssb_table_id: source.tableId,
    });
  }

  return rows;
}
