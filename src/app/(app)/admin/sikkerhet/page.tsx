import type { Metadata } from "next";

import { MfaSetupCard } from "@/components/admin/mfa-setup-card";
import { PageHeader } from "@/components/layout/page-header";
import { userHasVerifiedMfa } from "@/lib/auth/mfa";

export const metadata: Metadata = {
  title: "Sikkerhet",
};

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const hasMfa = await userHasVerifiedMfa();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Sikkerhet"
        description="Tofaktorautentisering for administratorer."
      />
      <MfaSetupCard alreadyEnabled={hasMfa} />
    </div>
  );
}
