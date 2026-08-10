/** Offentlig app-URL for e-postlenker (invitasjon, passordtilbakestilling). */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    if (!configured) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL må være satt i produksjon (e-postlenker).",
      );
    }
    return configured;
  }

  return configured || "http://localhost:3000";
}

/**
 * Redirect-URL for Supabase e-postlenker (invite / glemt passord).
 * Peker på PKCE-callback; e-postmaler med token_hash bør heller bruke
 * /auth/confirm (se README). `next` default er sett-passord-siden.
 */
export function authCallbackUrl(next = "/oppdater-passord"): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}
