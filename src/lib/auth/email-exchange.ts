import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { getServerSiteUrl } from "@/lib/auth/site-url.server";
import { createAuthRedirectClient } from "@/lib/supabase/auth-route";

const DEFAULT_NEXT = "/oppdater-passord";

function canonicalOrigin(request: NextRequest): string {
  try {
    return getServerSiteUrl();
  } catch {
    return new URL(request.url).origin;
  }
}

/**
 * Én inngang for e-postlenker: token_hash (anbefalt) eller PKCE code (fallback).
 * Sesjons-cookies settes på redirect-responsen.
 */
export async function handleAuthEmailExchange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = canonicalOrigin(request);
  const next = safeRedirectPath(searchParams.get("next") || DEFAULT_NEXT);
  const authError = searchParams.get("error");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (authError) {
    console.error("[auth] provider error:", authError);
    return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
  }

  if (token_hash && type) {
    const { supabase, getResponse } = createAuthRedirectClient(request, () =>
      NextResponse.redirect(`${origin}${next}`),
    );
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      console.error("[auth/confirm] verifyOtp failed:", error.message, {
        type,
      });
      return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
    }
    return getResponse();
  }

  if (code) {
    const { supabase, getResponse } = createAuthRedirectClient(request, () =>
      NextResponse.redirect(`${origin}${next}`),
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error(
        "[auth/confirm] exchangeCodeForSession failed:",
        error.message,
      );
      return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
    }
    return getResponse();
  }

  console.error("[auth/confirm] missing token_hash/type and code");
  return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
}
