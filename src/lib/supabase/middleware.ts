import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { buildContentSecurityPolicy } from "@/lib/security/csp";
import type { Database } from "@/lib/supabase/types";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Ruter som er tilgjengelige uten innlogging. */
const PUBLIC_ROUTES = [
  "/login",
  "/glemt-passord",
  "/oppdater-passord",
  "/auth",
  "/api/sync",
  "/.well-known",
];

function applyCsp(
  request: NextRequest,
  response: NextResponse,
  nonce: string,
): NextResponse {
  const csp = buildContentSecurityPolicy(nonce);
  // Next.js leser CSP fra request for å sette nonce på scripts.
  request.headers.set("Content-Security-Policy", csp);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function updateSession(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-nonce", nonce);

  const csp = buildContentSecurityPolicy(nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  supabaseResponse.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          supabaseResponse.headers.set("Content-Security-Policy", csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // VIKTIG: ikke kjør kode mellom createServerClient og getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    const redirectResponse = NextResponse.redirect(url);
    return applyCsp(request, redirectResponse, nonce);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    return applyCsp(request, redirectResponse, nonce);
  }

  // Tillat /glemt-passord også for innloggede (stale session / bytte passord).

  return supabaseResponse;
}
