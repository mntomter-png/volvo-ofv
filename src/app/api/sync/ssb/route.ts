import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/auth/client-ip";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { verifyRequestBearerSecret } from "@/lib/auth/verify-secret";
import { runSsbSync } from "@/lib/sync/run-ssb-sync";

function isAuthorized(request: Request): boolean {
  return verifyRequestBearerSecret(request, process.env.SYNC_SECRET);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(request.headers);
  if (
    !(await checkRateLimit(`sync-ssb:${clientIp}`, 6, 60 * 60 * 1000)) ||
    !(await checkRateLimit("sync-ssb:global", 20, 60 * 60 * 1000))
  ) {
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
