import type { EmailOtpType } from "@supabase/supabase-js";
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

export type AuthExchangeInput = {
  token_hash?: string | null;
  type?: string | null;
  code?: string | null;
  next?: string | null;
  authError?: string | null;
};

/**
 * Utfører sesjonsbytte for e-postlenker.
 * Skal kun kalles fra POST (eller eksplisitt brukerhandling) —
 * aldri automatisk på GET (e-postskannere / Safe Links bruker engangstoken).
 */
export async function exchangeAuthEmailSession(
  request: NextRequest,
  input: AuthExchangeInput,
) {
  const origin = canonicalOrigin(request);
  const next = safeRedirectPath(input.next || DEFAULT_NEXT);

  if (input.authError) {
    console.error("[auth] provider error:", input.authError);
    return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
  }

  const token_hash = input.token_hash?.trim() || null;
  const type = (input.type?.trim() || null) as EmailOtpType | null;
  const code = input.code?.trim() || null;

  if (token_hash && type) {
    const { supabase, getResponse } = createAuthRedirectClient(request, () =>
      NextResponse.redirect(`${origin}${next}`),
    );
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      console.error("[auth/exchange] verifyOtp failed:", error.message, {
        type,
        code: error.code,
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
        "[auth/exchange] exchangeCodeForSession failed:",
        error.message,
      );
      return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
    }
    return getResponse();
  }

  console.error("[auth/exchange] missing token_hash/type and code");
  return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
}
