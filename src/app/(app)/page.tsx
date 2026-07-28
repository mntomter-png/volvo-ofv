import { ArrowUpRight, BookMarked, TrendingUp, Truck } from "lucide-react";
import Link from "next/link";

import { BrandedMakeShareChart } from "@/components/dashboard/branded-make-share-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { RegistrationsByMonthChart } from "@/components/dashboard/registrations-by-month-chart";
import { SyncHealthBadge } from "@/components/dashboard/sync-health-badge";
import { SegmentTable } from "@/components/dashboard/segment-table";
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

export default async function DashboardPage() {
  const user = await requirePageAccess("dashboard");
  const brand = getUserBrand(user);

  const data = await getDashboardData(
    { segment: null, region: null, pabygg: null },
    brand.makeName,
  );
  const { kpis } = data;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Oversikt"
        description="Felles markedsinnsikt for tunge lastebiler (> 16t) og bestand i Norge. Samme bilde for alle — filtrering og egne snitt finner du under Nyregistreringer og Populasjon."
      />

      <div className="mb-6">
        <SyncHealthBadge />
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
              Volvo påbygg (Anlegg / Distribusjon / Langtransport / Annet) med{" "}
              {brand.shareLabel.toLowerCase()} per segment, hittil i år
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentTable
              data={data.registrationsBySegment}
              exploreHref="/nyregistreringer"
              hint="Klikk på et segment for å åpne det i Nyregistreringer."
            />
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
