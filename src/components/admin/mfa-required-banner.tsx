import Link from "next/link";
import type { Route } from "next";
import { ShieldAlert } from "lucide-react";

export function MfaRequiredBanner() {
  return (
    <div
      className="mb-6 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Tofaktorautentisering (MFA) er ikke aktivert for din admin-konto.
          Aktiver det for å beskytte brukeradministrasjon.
        </p>
      </div>
      <Link
        href={"/admin/sikkerhet" as Route}
        className="shrink-0 font-medium underline underline-offset-4"
      >
        Sett opp MFA
      </Link>
    </div>
  );
}
