import { type NextRequest } from "next/server";

import { handleAuthEmailExchange } from "@/lib/auth/email-exchange";

/**
 * Legacy PKCE-callback. Samme logikk som /auth/confirm (bakoverkompatibilitet).
 */
export async function GET(request: NextRequest) {
  return handleAuthEmailExchange(request);
}
