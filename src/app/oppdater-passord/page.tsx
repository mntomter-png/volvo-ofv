import type { Metadata } from "next";
import Link from "next/link";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Oppdater passord",
};

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Lenken er ugyldig eller utløpt
          </h1>
          <p className="text-sm text-muted-foreground">
            Be om en ny lenke for å tilbakestille passordet, eller logg inn hvis
            du allerede har tilgang.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild variant="accent">
              <Link href="/glemt-passord">Be om ny lenke</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Gå til innlogging</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
