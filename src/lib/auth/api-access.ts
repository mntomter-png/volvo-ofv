import "server-only";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import type { AppPage } from "@/lib/auth/role-config";
import { canAccess, getSessionUser, getUserRole } from "@/lib/auth/roles";
import { getUserBrandId } from "@/lib/brand/user-brand";

export class ApiAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "ApiAccessError";
  }
}

/**
 * Side-tilgang for API-ruter (JSON 401/403, aldri redirect).
 * Bruk i stedet for requirePageAccess i route handlers.
 */
export async function requireApiPageAccess(page: AppPage): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiAccessError("Ikke innlogget.", 401);
  }
  if (!getUserBrandId(user)) {
    throw new ApiAccessError("Kontoen mangler gyldig merkevare.", 403);
  }
  if (!canAccess(user, page)) {
    const role = getUserRole(user);
    throw new ApiAccessError(
      role
        ? "Du har ikke tilgang til denne eksporten."
        : "Kontoen mangler gyldig rolle.",
      403,
    );
  }
  return user;
}

/** Konverter ApiAccessError (eller ukjent) til Response uten å maskere 500 som 401. */
export function apiErrorResponse(error: unknown): NextResponse {
  // Next.js redirect() må boble — aldri svelg som 500.
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof ApiAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(
    "[api]",
    error instanceof Error ? error.message : error,
  );
  return NextResponse.json(
    { error: "Intern feil. Prøv igjen senere." },
    { status: 500 },
  );
}
