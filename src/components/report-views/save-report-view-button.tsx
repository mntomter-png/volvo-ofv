"use client";

import { useQueryState } from "nuqs";

import { SaveReportViewDialog } from "@/components/report-views/save-report-view-dialog";
import {
  buildDashboardConfig,
  describeReportViewConfig,
} from "@/lib/report-views/config";

export function DashboardSaveReportViewButton() {
  const [segment] = useQueryState("segment");
  const config = buildDashboardConfig(segment);
  const filterSummary = describeReportViewConfig("dashboard", config);

  return (
    <SaveReportViewDialog
      pageType="dashboard"
      config={config}
      filterSummary={filterSummary}
      description="Lagrer gjeldende filter fra oversikten slik at du kan hente det fram igjen senere."
    />
  );
}

// Backwards-compatible export
export function SaveReportViewButton() {
  return <DashboardSaveReportViewButton />;
}
