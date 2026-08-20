import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Ingen tilgang",
};

export const dynamic = "force-dynamic";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Kontoen mangler tilgang
        </h1>
        <p className="text-sm text-muted-foreground">
          Brukeren din har ingen gyldig rolle i systemet. Kontakt en
          administrator for å få tilordnet riktig rolle.
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
