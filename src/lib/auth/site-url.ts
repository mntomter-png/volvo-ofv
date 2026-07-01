/** Offentlig app-URL for e-postlenker (invitasjon, passordtilbakestilling). */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Full redirect-URL via auth callback etter e-postlenke. */
export function authCallbackUrl(next = "/"): string {
  const siteUrl = getSiteUrl();
  if (next === "/") {
    return `${siteUrl}/auth/callback`;
  }
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}
