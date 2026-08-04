import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import type { Database } from "@/lib/supabase/types";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Auth-callback for e-postlenker (invitasjon / glemt passord).
 * Sesjons-cookies må settes på selve redirect-responsen – ellers mister
 * nettleseren sesjonen og middleware sender brukeren til /login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));
  const authError = searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      `${origin}/glemt-passord?error=auth`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  let redirectResponse = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          redirectResponse = NextResponse.redirect(`${origin}${next}`);
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${origin}/glemt-passord?error=auth`);
  }

  return redirectResponse;
}
