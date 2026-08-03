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

/** Full redirect-URL via auth callback etter e-postlenke. */
export function authCallbackUrl(next = "/"): string {
  const siteUrl = getSiteUrl();
  if (next === "/") {
    return `${siteUrl}/auth/callback`;
  }
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}
