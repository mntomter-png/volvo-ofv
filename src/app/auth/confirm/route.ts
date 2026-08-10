import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createAuthRedirectClient } from "@/lib/supabase/auth-route";

const DEFAULT_NEXT = "/oppdater-passord";

/**
 * Token-hash-bekreftelse for e-postlenker (recovery / invite / signup).
 * Fungerer på tvers av nettlesere (i motsetning til ren PKCE code-exchange).
 *
 * Krever at Supabase e-postmaler bruker:
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/oppdater-passord
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(
    searchParams.get("next") || DEFAULT_NEXT,
  );

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
  }

  const { supabase, getResponse } = createAuthRedirectClient(request, () =>
    NextResponse.redirect(`${origin}${next}`),
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    console.error("[auth/confirm] verifyOtp failed:", error.message);
    return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
  }

  return getResponse();
}
