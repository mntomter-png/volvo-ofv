"use client";

import { useQueryState, parseAsInteger } from "nuqs";

import { SaveReportViewDialog } from "@/components/report-views/save-report-view-dialog";
import {
  buildPopulasjonConfig,
  describeReportViewConfig,
} from "@/lib/report-views/config";

export function PopulasjonSaveReportViewButton() {
  const [pabygg] = useQueryState("pabygg");
  const [bodywork] = useQueryState("bodywork", parseAsInteger);
  const [make] = useQueryState("make");
  const [district] = useQueryState("district");

  const config = buildPopulasjonConfig({
    pabygg: pabygg ?? null,
    bodywork: bodywork ?? null,
    make: make ?? null,
    district: district ?? null,
  });
  const filterSummary = describeReportViewConfig("populasjon", config);

  return (
    <SaveReportViewDialog
      pageType="populasjon"
      config={config}
      filterSummary={filterSummary}
      description="Lagrer gjeldende filter fra bestand slik at du kan hente det fram igjen senere."
    />
  );
}
