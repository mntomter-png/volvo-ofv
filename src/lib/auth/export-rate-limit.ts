import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/auth/client-ip";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const EXPORT_MAX_PER_HOUR = 10;
const EXPORT_WINDOW_MS = 60 * 60 * 1000;

/** Rate limit Excel-eksport per bruker (fallback: IP). */
export async function assertExportRateLimit(params: {
  request: Request;
  userId: string;
  route: string;
}): Promise<NextResponse | null> {
  const ip = getClientIp(params.request.headers);
  const key = `export:${params.route}:${params.userId || ip}`;
  if (!(await checkRateLimit(key, EXPORT_MAX_PER_HOUR, EXPORT_WINDOW_MS))) {
    return NextResponse.json(
      { error: "For mange eksporter. Prøv igjen senere." },
      { status: 429 },
    );
  }
  return null;
}
