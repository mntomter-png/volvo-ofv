import "server-only";

/**
 * Offentlig app-URL for server-side auth (e-postlenker).
 * Krev SITE_URL i produksjon (runtime) – ikke stol på bake-in NEXT_PUBLIC_*.
 */
export function getServerSiteUrl(): string {
  const siteUrl = (process.env.SITE_URL?.trim() || "").replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    if (!siteUrl) {
      throw new Error(
        "SITE_URL må være satt i produksjon (e-postlenker / auth redirect).",
      );
    }
    return siteUrl;
  }

  const fallback = (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"
  ).replace(/\/$/, "");

  return siteUrl || fallback;
}

/**
 * redirectTo registrert hos Supabase for reset/invite.
 * Peker på /auth/confirm (én sti for token_hash og PKCE code).
 */
export function authCallbackUrl(next = "/oppdater-passord"): string {
  const siteUrl = getServerSiteUrl();
  return `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
}
