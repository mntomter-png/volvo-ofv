/** Ren SITE_URL-logikk uten server-only, slik at den kan testes. */

export type SiteUrlEnv = {
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NODE_ENV?: string;
};

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/$/, "");
}

/**
 * Offentlig app-URL for server-side auth (e-postlenker).
 * Produksjon krever SITE_URL — ingen stille NEXT_PUBLIC-fallback.
 */
export function resolveServerSiteUrl(env: SiteUrlEnv): string {
  const siteUrl = normalizeUrl(env.SITE_URL ?? "");

  if (env.NODE_ENV === "production") {
    if (!siteUrl) {
      throw new Error(
        "SITE_URL må være satt i produksjon (e-postlenker / auth redirect).",
      );
    }
    return siteUrl;
  }

  const fallback = normalizeUrl(
    env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  );

  return siteUrl || fallback;
}

/**
 * redirectTo registrert hos Supabase for reset/invite.
 * Peker på /auth/confirm (én sti for token_hash og PKCE code).
 */
export function buildAuthCallbackUrl(
  siteUrl: string,
  next = "/oppdater-passord",
): string {
  return `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/**
 * Origin for auth-redirect etter e-postlenke.
 * I produksjon: aldri fall tilbake til request-Host (fail closed).
 */
export function resolveAuthOrigin(env: SiteUrlEnv, requestUrl: string): string {
  try {
    return resolveServerSiteUrl(env);
  } catch (error) {
    if (env.NODE_ENV === "production") {
      throw error;
    }
    return new URL(requestUrl).origin;
  }
}
