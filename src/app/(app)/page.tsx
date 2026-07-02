import { ArrowUpRight, BookMarked, TrendingUp, Truck } from "lucide-react";
import Link from "next/link";

import { BrandedMakeShareChart } from "@/components/dashboard/branded-make-share-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { RegistrationsByMonthChart } from "@/components/dashboard/registrations-by-month-chart";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { ALL_PABYGG_SEGMENTS } from "@/lib/ofv/segmentation";
import { SegmentTable } from "@/components/dashboard/segment-table";
import { ReportViewToolbar } from "@/components/report-views/report-view-toolbar";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDate,
  getDashboardData,
} from "@/lib/dashboard/queries";
import { getReportViews } from "@/lib/report-views/queries";
import { getUserBrand } from "@/lib/brand/user-brand";
import { requirePageAccess } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const quickLinks = [
  {
    title: "Nyregistreringer",
    href: "/nyregistreringer",
    icon: TrendingUp,
    description:
      "Analyser registreringer av tunge kjøretøy over tid, etter merke og segment.",
  },
  {
    title: "Populasjon / Bestand",
    href: "/populasjon",
    icon: Truck,
    description:
      "Utforsk den totale kjøretøypopulasjonen og bestandsutviklingen i markedet.",
  },
  {
    title: "Rapportvisninger",
    href: "/rapportvisninger",
    icon: BookMarked,
    description:
      "Lagre og gjenbruk dine egne, tilpassede visninger og analyser.",
  },
] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess("dashboard");
  const brand = getUserBrand(user);

  const params = await searchParams;
  const segment =
    typeof params.segment === "string" && params.segment.length > 0
      ? params.segment
      : null;
  const regionRaw =
    typeof params.region === "string" ? Number.parseInt(params.region, 10) : NaN;
  const region =
    Number.isFinite(regionRaw) && regionRaw >= 1 && regionRaw <= 5
      ? regionRaw
      : null;
  const pabyggRaw = typeof params.pabygg === "string" ? params.pabygg : null;
  const pabygg =
    pabyggRaw &&
    (ALL_PABYGG_SEGMENTS as readonly string[]).includes(pabyggRaw)
      ? pabyggRaw
      : null;

  const dashboardFilters = { segment, region, pabygg };
  const [data, dashboardViews] = await Promise.all([
    getDashboardData(dashboardFilters, brand.makeName),
    getReportViews("dashboard"),
  ]);
  const { kpis } = data;

  const segmentOptions = data.registrationsBySegment.map((row) => row.segment);

  const dataFreshness =
    kpis.lastSyncedAt && kpis.populationSnapshotDate
      ? `OFV-data per ${formatDate(kpis.populationSnapshotDate)} · synket ${formatDate(kpis.lastSyncedAt)}`
      : "Venter på datasynk";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Oversikt"
        description="Markedsinnsikt for tunge lastebiler (> 16t) og bestand i Norge, segmentert etter OFVs oppbygning (Usage)."
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">{dataFreshness}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <DashboardFilters segments={segmentOptions} />
          <ReportViewToolbar views={dashboardViews} />
        </div>
      </div>

      {data.error ? (
        <p className="mb-4 text-sm text-destructive">
          Kunne ikke hente dashborddata: {data.error}
        </p>
      ) : null}

      <section className="mb-6">
        <KpiCards kpis={kpis} />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nyregistreringer per måned</CardTitle>
            <CardDescription>
              Førstegangsregistrerte nye lastebiler i {new Date().getFullYear()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationsByMonthChart data={data.registrationsByMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merkefordeling – nyregistreringer</CardTitle>
            <CardDescription>Topp 10 merker hittil i år</CardDescription>
          </CardHeader>
          <CardContent>
            <BrandedMakeShareChart
              data={data.registrationsByMake}
              total={kpis.totalRegistrationsYtd}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segmenter – nyregistreringer</CardTitle>
            <CardDescription>
              OFV-oppbygning (Usage) med {brand.shareLabel.toLowerCase()} per segment, hittil i år
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentTable data={data.registrationsBySegment} />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merkefordeling – bestand</CardTitle>
            <CardDescription>
              Registrerte lastebiler per merke
              {kpis.populationSnapshotDate
                ? ` (${formatDate(kpis.populationSnapshotDate)})`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandedMakeShareChart
              data={data.populationByMake}
              total={kpis.populationTotal}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="group">
              <Card className="h-full transition-all group-hover:border-volvo-blue/40 group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-volvo-blue">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <CardTitle className="pt-2 text-base">{link.title}</CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
