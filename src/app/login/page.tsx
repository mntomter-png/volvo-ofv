import type { Metadata } from "next";

import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = {
  title: "Logg inn",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <main className="relative grid min-h-svh lg:grid-cols-2">
      {/* Venstre: merkevarepanel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex items-center">
          <div className="leading-tight">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-accent">
              Volvo Trucks
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/70">
              Norge
            </p>
          </div>
        </div>

        <div className="relative max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Markedsinnsikt og registreringsstatistikk
          </h1>
          <p className="text-primary-foreground/80">
            Internt analyseverktøy for nyregistreringer og bestand av tunge
            kjøretøy, basert på offisielle data fra OFV Statistikk.
          </p>
          <div className="h-1 w-24 rounded-full bg-accent" />
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          Kun for autorisert internt bruk i Volvo Group · OFV-data
        </p>
      </div>

      {/* Høyre: innloggingsskjema */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 lg:hidden">
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-primary">
              Volvo Trucks
            </span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              Velkommen tilbake
            </h2>
            <p className="text-sm text-muted-foreground">
              Logg inn med din Volvo-konto for å fortsette til Volvo OFV.
            </p>
          </div>

          <LoginForm redirectTo={redirectTo ?? "/"} />

          <p className="text-center text-xs text-muted-foreground">
            Problemer med innlogging? Kontakt din lokale IT-administrator.
          </p>
        </div>
      </div>
    </main>
  );
}
