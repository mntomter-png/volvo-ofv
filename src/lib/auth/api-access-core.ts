import { isRedirectError } from "next/dist/client/components/redirect-error";
import { NextResponse } from "next/server";

export class ApiAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "ApiAccessError";
  }
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
