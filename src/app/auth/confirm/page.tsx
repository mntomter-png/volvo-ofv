import type { Metadata } from "next";
import Link from "next/link";

import { AuthConfirmForm } from "@/components/auth/auth-confirm-form";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Bekreft tilgang",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]?.trim()) return value[0].trim();
  return null;
}

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  const code = first(params.code);
  const next = safeRedirectPath(first(params.next) || "/oppdater-passord");
  const providerError = first(params.error);

  if (providerError) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Lenken kunne ikke brukes
          </h1>
          <p className="text-sm text-muted-foreground">
            Autentiseringstjenesten avviste lenken. Be en administrator om en ny
            invitasjon, eller be om ny passordlenke.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild variant="accent">
              <Link href="/glemt-passord">Be om ny passordlenke</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Gå til innlogging</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if ((!tokenHash || !type) && !code) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Mangler bekreftelsesdata
          </h1>
          <p className="text-sm text-muted-foreground">
            Åpne lenken direkte fra e-posten. Hvis den er utløpt, be om en ny
            invitasjon eller passordlenke.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild variant="accent">
              <Link href="/glemt-passord">Be om ny passordlenke</Link>
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
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Bekreft for å fortsette
          </h1>
          <p className="text-sm text-muted-foreground">
            Av sikkerhetshensyn må du bekrefte manuelt. Dette hindrer at
            e-postfiltre bruker engangslenken før du gjør det.
          </p>
        </div>
        <AuthConfirmForm
          tokenHash={tokenHash}
          type={type}
          code={code}
          next={next}
        />
      </div>
    </main>
  );
}
