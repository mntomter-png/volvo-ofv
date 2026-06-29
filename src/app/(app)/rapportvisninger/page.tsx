import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ReportViewsList } from "@/components/report-views/report-views-list";
import { getReportViews } from "@/lib/report-views/queries";

export const metadata: Metadata = {
  title: "Rapportvisninger",
};

export default async function RapportvisningerPage() {
  const views = await getReportViews();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Rapportvisninger"
        description="Dine personlige, lagrede visninger. Tilpass filtre på en side, lagre dem her, og hent dem fram igjen når du trenger dem."
      />

      <ReportViewsList views={views} />
    </div>
  );
}
