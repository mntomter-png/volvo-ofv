import "server-only";

import { Redis } from "@upstash/redis";

import { authCallbackUrl, getServerSiteUrl } from "@/lib/auth/site-url.server";
import { userHasVerifiedMfa } from "@/lib/auth/mfa";

/** Kanonisk produksjons-host — health feiler hvis SITE_URL avviker. */
export const CANONICAL_SITE_HOST = "app.biloversikt.com";
export const CANONICAL_SITE_URL = `https://${CANONICAL_SITE_HOST}`;

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

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/$/, "");
}

async function pingUpstash(): Promise<{ ok: boolean; detail: string }> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return { ok: false, detail: "UPSTASH_REDIS_REST_URL/TOKEN mangler." };
  }
  try {
    const redis = new Redis({ url, token });
    const pong = await redis.ping();
    if (String(pong).toUpperCase() === "PONG") {
      return { ok: true, detail: "Redis svarte PONG." };
    }
    return { ok: false, detail: `Uventet ping-svar: ${String(pong)}` };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Upstash-ping feilet.",
    };
  }
}

/**
 * Runtime-sjekk av auth-konfig for ops (ingen secrets i output).
 * Kan ikke verifisere Supabase Dashboard allowlist/maler direkte.
 */
export async function getAuthHealthReport(): Promise<AuthHealthReport> {
  const isProd = process.env.NODE_ENV === "production";
  const siteUrlRaw = normalizeUrl(process.env.SITE_URL ?? "");
  const publicSiteUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "");

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

  const [hasMfa, upstash] = await Promise.all([
    userHasVerifiedMfa(),
    pingUpstash(),
  ]);

  const siteMatchesCanonical =
    Boolean(serverSiteUrl) && serverSiteUrl === CANONICAL_SITE_URL;

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
      id: "canonical-host",
      label: `Kanonisk host (${CANONICAL_SITE_HOST})`,
      status: isProd
        ? siteMatchesCanonical
          ? "ok"
          : "fail"
        : siteMatchesCanonical
          ? "ok"
          : "warn",
      detail: siteMatchesCanonical
        ? `SITE_URL matcher ${CANONICAL_SITE_URL}.`
        : serverSiteUrl
          ? `Forventet ${CANONICAL_SITE_URL}, fikk ${serverSiteUrl}.`
          : `Forventet ${CANONICAL_SITE_URL}.`,
    },
    {
      id: "public-site-url",
      label: "NEXT_PUBLIC_SITE_URL",
      status: publicSiteUrl
        ? publicSiteUrl === CANONICAL_SITE_URL || !isProd
          ? "ok"
          : "fail"
        : isProd
          ? "warn"
          : "ok",
      detail: publicSiteUrl
        ? publicSiteUrl === CANONICAL_SITE_URL || !isProd
          ? publicSiteUrl
          : `Avviker fra kanonisk: ${publicSiteUrl}`
        : "Ikke satt (valgfri fallback lokalt).",
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
      status:
        sampleRedirectTo?.startsWith(`${CANONICAL_SITE_URL}/auth/confirm`) ||
        (!isProd && sampleRedirectTo?.includes("/auth/confirm"))
          ? "ok"
          : sampleRedirectTo?.includes("/auth/confirm")
            ? isProd
              ? "fail"
              : "warn"
            : "fail",
      detail:
        sampleRedirectTo ??
        "Kunne ikke bygge redirectTo (SITE_URL mangler).",
    },
    {
      id: "upstash",
      label: "Upstash Redis (rate limit)",
      status: upstash.ok ? "ok" : isProd ? "fail" : "warn",
      detail: upstash.detail,
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
      `Authentication → URL Configuration → Site URL = ${CANONICAL_SITE_URL}`,
      `Redirect URLs inkluderer ${CANONICAL_SITE_URL}/** (eller minst /auth/confirm)`,
      "Recovery- og Invite-maler bruker /auth/confirm?token_hash=… (bruker klikker «Fortsett» — ikke auto-verify på GET)",
      "RLS jwt_app_role() har ingen default til salg; legacy JWT-rolle admin er fjernet",
    ],
  };
}
