import "server-only";

import {
  buildAuthCallbackUrl,
  resolveAuthOrigin,
  resolveServerSiteUrl,
} from "@/lib/auth/site-url-core";

/**
 * Offentlig app-URL for server-side auth (e-postlenker).
 * Krev SITE_URL i produksjon (runtime) – ikke stol på bake-in NEXT_PUBLIC-*.
 */
export function getServerSiteUrl(): string {
  return resolveServerSiteUrl(process.env);
}

/**
 * redirectTo registrert hos Supabase for reset/invite.
 * Peker på /auth/confirm (én sti for token_hash og PKCE code).
 */
export function authCallbackUrl(next = "/oppdater-passord"): string {
  return buildAuthCallbackUrl(getServerSiteUrl(), next);
}

/** Origin for auth-redirect. I prod kastes hvis SITE_URL mangler. */
export function getRequestAuthOrigin(requestUrl: string): string {
  return resolveAuthOrigin(process.env, requestUrl);
}
