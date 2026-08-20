import "server-only";

import { authCallbackUrl, getServerSiteUrl } from "@/lib/auth/site-url.server";
import { userHasVerifiedMfa } from "@/lib/auth/mfa";

export type AuthHealthStatus = "ok" | "warn" | "fail";

export type AuthHealthCheck = {
  id: string;
  label: string;
  status: AuthHealthStatus;
  detail: string;
};

export type AuthHealthReport = {
  checks: AuthHealthCheck[];
  hasMfa: boolean;
  sampleRedirectTo: string | null;
  expectedTemplateHint: string;
  supabaseChecklist: string[];
};

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/**
 * Runtime-sjekk av auth-konfig for ops (ingen secrets i output).
 * Kan ikke verifisere Supabase Dashboard allowlist/maler direkte.
 */
export async function getAuthHealthReport(): Promise<AuthHealthReport> {
  const isProd = process.env.NODE_ENV === "production";
  const siteUrlRaw = process.env.SITE_URL?.trim().replace(/\/$/, "") ?? "";
  const publicSiteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || ""
  ).replace(/\/$/, "");
  const upstashReady =
    hasEnv("UPSTASH_REDIS_REST_URL") && hasEnv("UPSTASH_REDIS_REST_TOKEN");

  let serverSiteUrl: string | null = null;
  let siteUrlError: string | null = null;
  try {
    serverSiteUrl = getServerSiteUrl();
  } catch (error) {
    siteUrlError =
      error instanceof Error ? error.message : "SITE_URL kunne ikke leses.";
  }

  let sampleRedirectTo: string | null = null;
  if (serverSiteUrl) {
    try {
      sampleRedirectTo = authCallbackUrl("/oppdater-passord");
    } catch {
      sampleRedirectTo = null;
    }
  }

  const hasMfa = await userHasVerifiedMfa();

  const checks: AuthHealthCheck[] = [
    {
      id: "site-url",
      label: "SITE_URL (runtime auth)",
      status: serverSiteUrl
        ? "ok"
        : isProd
          ? "fail"
          : siteUrlRaw
            ? "ok"
            : "warn",
      detail: serverSiteUrl
        ? serverSiteUrl
        : (siteUrlError ??
          (isProd
            ? "Mangler i produksjon — e-postlenker vil feile."
            : "Ikke satt; lokal fallback til NEXT_PUBLIC_SITE_URL / localhost.")),
    },
    {
      id: "public-site-url",
      label: "NEXT_PUBLIC_SITE_URL",
      status: publicSiteUrl ? "ok" : isProd ? "warn" : "ok",
      detail: publicSiteUrl || "Ikke satt (valgfri fallback lokalt).",
    },
    {
      id: "site-url-match",
      label: "SITE_URL ↔ NEXT_PUBLIC_SITE_URL",
      status:
        siteUrlRaw && publicSiteUrl && siteUrlRaw !== publicSiteUrl
          ? "fail"
          : siteUrlRaw && publicSiteUrl
            ? "ok"
            : "warn",
      detail:
        siteUrlRaw && publicSiteUrl && siteUrlRaw !== publicSiteUrl
          ? `Mismatch: SITE_URL=${siteUrlRaw} vs NEXT_PUBLIC=${publicSiteUrl}`
          : siteUrlRaw && publicSiteUrl
            ? "Samme verdi."
            : "Kan ikke sammenligne (én eller begge mangler).",
    },
    {
      id: "redirect-to",
      label: "Eksempel redirectTo (invite/reset)",
      status: sampleRedirectTo?.includes("/auth/confirm") ? "ok" : "fail",
      detail:
        sampleRedirectTo ??
        "Kunne ikke bygge redirectTo (SITE_URL mangler).",
    },
    {
      id: "upstash",
      label: "Upstash Redis (rate limit)",
      status: upstashReady ? "ok" : isProd ? "fail" : "warn",
      detail: upstashReady
        ? "URL + token er satt."
        : isProd
          ? "Mangler i produksjon — rate limit fail-closed (avviser)."
          : "Mangler; lokal in-memory fallback er OK.",
    },
    {
      id: "mfa",
      label: "MFA på din konto",
      status: hasMfa ? "ok" : "warn",
      detail: hasMfa
        ? "Verifisert TOTP-faktor funnet."
        : "Ingen verifisert TOTP — påkrevd for øvrig admin-tilgang.",
    },
  ];

  return {
    checks,
    hasMfa,
    sampleRedirectTo,
    expectedTemplateHint:
      "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/oppdater-passord",
    supabaseChecklist: [
      "Authentication → URL Configuration → Site URL = samme verdi som SITE_URL",
      "Redirect URLs inkluderer {SITE_URL}/** (eller minst /auth/confirm)",
      "Recovery- og Invite-maler bruker /auth/confirm?token_hash=… (ikke bare {{ .ConfirmationURL }}/auth/callback)",
    ],
  };
}
