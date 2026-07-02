import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/auth/rate-limit";
import { runOfvSync } from "@/lib/sync/run-ofv-sync";

function isAuthorized(request: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`sync:${clientIp}`, 6, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
  } catch {
    return NextResponse.json({ error: "Synk feilet" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: "Bruk POST for å starte OFV-synk (Authorization: Bearer header)",
    scopes: ["full", "registrations", "population"],
  });
}
