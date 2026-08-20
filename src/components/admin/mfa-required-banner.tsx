import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/** Vises kun på /admin/sikkerhet når MFA mangler (hard gate ellers). */
export function MfaRequiredBanner() {
  return (
    <div
      className="mb-6 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Admin er låst til denne siden til MFA er aktivert. Sett opp
          tofaktorautentisering under for å fortsette til brukeradministrasjon.
        </p>
      </div>
      <Link
        href="#mfa-setup"
        className="shrink-0 font-medium underline underline-offset-4 sm:self-end"
      >
        Gå til oppsett
      </Link>
    </div>
  );
}
