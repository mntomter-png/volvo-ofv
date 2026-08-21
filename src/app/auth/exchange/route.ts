import { type NextRequest } from "next/server";

import { exchangeAuthEmailSession } from "@/lib/auth/email-exchange";

/**
 * POST-only sesjonsbytte for invite/recovery.
 * GET er bevisst ikke støttet — e-postskannere skal ikke bruke engangstoken.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  return exchangeAuthEmailSession(request, {
    token_hash: String(form.get("token_hash") ?? "") || null,
    type: String(form.get("type") ?? "") || null,
    code: String(form.get("code") ?? "") || null,
    next: String(form.get("next") ?? "") || null,
  });
}
