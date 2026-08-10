import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Supabase-klient for auth-route-handlere der sesjons-cookies må
 * settes på selve redirect-responsen (ikke bare request-cookien).
 */
export function createAuthRedirectClient(
  request: NextRequest,
  getRedirect: () => NextResponse,
) {
  let redirectResponse = getRedirect();

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
          redirectResponse = getRedirect();
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  return {
    supabase,
    getResponse: () => redirectResponse,
  };
}
