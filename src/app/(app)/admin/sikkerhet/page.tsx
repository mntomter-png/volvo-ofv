import type { Metadata } from "next";

import { AuthHealthCard } from "@/components/admin/auth-health-card";
import { MfaSetupCard } from "@/components/admin/mfa-setup-card";
import { PageHeader } from "@/components/layout/page-header";
import { getAuthHealthReport } from "@/lib/auth/auth-health";

export const metadata: Metadata = {
  title: "Sikkerhet",
};

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const authHealth = await getAuthHealthReport();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Sikkerhet"
        description="Tofaktorautentisering er påkrevd for administratorer før øvrig admin-tilgang."
      />
      <MfaSetupCard alreadyEnabled={authHealth.hasMfa} />
      <AuthHealthCard report={authHealth} />
    </div>
  );
}
