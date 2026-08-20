import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { getUserBrandId } from "@/lib/brand/user-brand";
import { firstAllowedRoute } from "@/lib/navigation";
import { getUserRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ingen tilgang",
};

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = getUserRole(user);
  const brandId = getUserBrandId(user);
  if (role && brandId) {
    redirect(firstAllowedRoute(role) as Route);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Kontoen mangler tilgang
        </h1>
        <p className="text-sm text-muted-foreground">
          Brukeren din har ingen gyldig rolle eller merkevare i systemet.
          Kontakt en administrator for å få tilordnet riktig tilgang.
        </p>
        <div className="flex flex-col gap-2">
          <form action={signOut}>
            <Button type="submit" variant="accent" className="w-full">
              Logg ut
            </Button>
          </form>
          <Button asChild variant="outline">
            <Link href="/login">Gå til innlogging</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
