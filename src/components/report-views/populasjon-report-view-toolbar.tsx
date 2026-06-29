"use client";

import { useQueryState } from "nuqs";

import { SaveReportViewDialog } from "@/components/report-views/save-report-view-dialog";
import {
  buildPopulasjonConfig,
  describeReportViewConfig,
} from "@/lib/report-views/config";

export function PopulasjonSaveReportViewButton() {
  const [segment] = useQueryState("segment");
  const [make] = useQueryState("make");

  const config = buildPopulasjonConfig({
    segment: segment ?? null,
    make: make ?? null,
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
