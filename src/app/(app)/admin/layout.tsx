import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";

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
  const pathname = (await headers()).get("x-pathname") ?? "";
  const onSecurityPage =
    pathname === "/admin/sikkerhet" ||
    pathname.startsWith("/admin/sikkerhet/");

  if (!hasMfa && !onSecurityPage) {
    redirect("/admin/sikkerhet" as Route);
  }

  return (
    <>
      {!hasMfa && onSecurityPage ? <MfaRequiredBanner /> : null}
      {children}
    </>
  );
}
