"use client";

import { useQueryState, parseAsInteger } from "nuqs";

import { SaveReportViewDialog } from "@/components/report-views/save-report-view-dialog";
import {
  buildNyregistreringerConfig,
  describeReportViewConfig,
} from "@/lib/report-views/config";

export function NyregistreringerSaveReportViewButton() {
  const [segment] = useQueryState("segment");
  const [make] = useQueryState("make");
  const [year] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()),
  );

  const config = buildNyregistreringerConfig({
    segment: segment ?? null,
    make: make ?? null,
    year,
  });
  const filterSummary = describeReportViewConfig("nyregistreringer", config);

  return (
    <SaveReportViewDialog
      pageType="nyregistreringer"
      config={config}
      filterSummary={filterSummary}
      description="Lagrer gjeldende filter fra nyregistreringer slik at du kan hente det fram igjen senere."
    />
  );
}
