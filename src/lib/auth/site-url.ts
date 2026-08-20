/** @deprecated Bruk site-url.server.ts på server. Beholdt for CLI-skript. */
export function getSiteUrl(): string {
  const configured =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  const siteUrl = configured.replace(/\/$/, "");
  return siteUrl || "http://localhost:3000";
}

export function authCallbackUrl(next = "/oppdater-passord"): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}
