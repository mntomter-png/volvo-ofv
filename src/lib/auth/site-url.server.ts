import "server-only";

/**
 * Offentlig app-URL for server-side auth (e-postlenker).
 * Bruker SITE_URL ved runtime – ikke NEXT_PUBLIC_* som bakes inn ved build.
 */
export function getServerSiteUrl(): string {
  const configured =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";

  const siteUrl = configured.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    if (!siteUrl) {
      throw new Error(
        "SITE_URL (eller NEXT_PUBLIC_SITE_URL) må være satt i produksjon.",
      );
    }
  }

  return siteUrl || "http://localhost:3000";
}

/** Redirect-URL registrert hos Supabase for passord-reset / invitasjon. */
export function authCallbackUrl(next = "/oppdater-passord"): string {
  const siteUrl = getServerSiteUrl();
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}
