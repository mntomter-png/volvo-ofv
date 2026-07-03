import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/auth/rate-limit";
import { runSsbSync } from "@/lib/sync/run-ssb-sync";

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
  if (!checkRateLimit(`sync-ssb:${clientIp}`, 6, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const result = await runSsbSync();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "SSB-synk feilet" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: "Bruk POST for å starte SSB-synk (Authorization: Bearer header)",
  });
}
