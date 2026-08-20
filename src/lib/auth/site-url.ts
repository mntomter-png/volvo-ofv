/**
 * CLI/scripts uten server-only. Produksjon skal bruke site-url.server.ts.
 */
export function getSiteUrl(): string {
  const siteUrl = (process.env.SITE_URL?.trim() || "").replace(/\/$/, "");
  if (siteUrl) return siteUrl;
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function authCallbackUrl(next = "/oppdater-passord"): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
}
