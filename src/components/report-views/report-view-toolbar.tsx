import { LoadReportViewSelect } from "@/components/report-views/load-report-view-select";
import { SaveReportViewButton } from "@/components/report-views/save-report-view-button";
import type { ReportViewRow } from "@/lib/report-views/queries";

interface ReportViewToolbarProps {
  views: ReportViewRow[];
}

export function DashboardReportViewToolbar({ views }: ReportViewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LoadReportViewSelect pageType="dashboard" views={views} />
      <SaveReportViewButton />
    </div>
  );
}

// Backwards-compatible export
export function ReportViewToolbar(props: ReportViewToolbarProps) {
  return <DashboardReportViewToolbar {...props} />;
}
