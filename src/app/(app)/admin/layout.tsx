import { MfaRequiredBanner } from "@/components/admin/mfa-required-banner";
import { userHasVerifiedMfa } from "@/lib/auth/mfa";
import { requirePageAccess } from "@/lib/auth/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("admin");
  const hasMfa = await userHasVerifiedMfa();

  return (
    <>
      {!hasMfa ? <MfaRequiredBanner /> : null}
      {children}
    </>
  );
}
