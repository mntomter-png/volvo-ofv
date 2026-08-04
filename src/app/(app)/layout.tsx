import { redirect } from "next/navigation";

import { BrandProvider } from "@/components/brand/brand-provider";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { trackPageVisit } from "@/lib/auth/track-activity";
import { getUserBrand } from "@/lib/brand/user-brand";
import { getUserRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fire-and-forget-ish: await men feiler stille i helper.
  await trackPageVisit();

  const role = getUserRole(user);
  const brand = getUserBrand(user);

  return (
    <BrandProvider brand={brand}>
      <div
        data-brand={brand.id}
        className="flex min-h-svh bg-background"
        style={
          {
            "--volvo-blue": brand.chartPrimary,
            "--volvo-yellow": brand.chartAccent,
          } as React.CSSProperties
        }
      >
        <Sidebar role={role} brand={brand} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header email={user.email ?? "ukjent bruker"} role={role} brand={brand} />
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </BrandProvider>
  );
}
