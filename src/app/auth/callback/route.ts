import { NextResponse, type NextRequest } from "next/server";

import { getServerSiteUrl } from "@/lib/auth/site-url.server";

/**
 * Legacy PKCE-callback: videresend til /auth/confirm uten å bruke token her.
 * Brukeren må klikke «Fortsett» (beskytter mot e-post-prefetch).
 */
export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = getServerSiteUrl();
  } catch {
    origin = new URL(request.url).origin;
  }

  const incoming = new URL(request.url);
  const target = new URL(`${origin}/auth/confirm`);
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  return NextResponse.redirect(target);
}
