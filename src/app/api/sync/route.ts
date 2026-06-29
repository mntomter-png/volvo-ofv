import { NextResponse } from "next/server";

import { runOfvSync } from "@/lib/sync/run-ofv-sync";

function isAuthorized(request: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let scope: "full" | "registrations" | "population" = "full";
  let force = false;

  try {
    const body = await request.json().catch(() => ({}));
    if (body.scope === "registrations" || body.scope === "population") {
      scope = body.scope;
    }
    if (body.force === true) force = true;
  } catch {
    // Tom body er OK – bruk standard scope.
  }

  try {
    const result = await runOfvSync({ scope, force });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synk feilet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: "Bruk POST for å starte OFV-synk",
    scopes: ["full", "registrations", "population"],
  });
}
