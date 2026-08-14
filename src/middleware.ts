import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match alle stier unntatt:
     * - _next/static, _next/image (statiske ressurser)
     * - favicon og bildefiler
     * - Netlify background/scheduled functions (cron-synk)
     */
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known/|\\.netlify/functions|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
