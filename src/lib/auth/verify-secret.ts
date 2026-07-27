import { timingSafeEqual } from "node:crypto";

/** Konstant-tids sammenligning av `Authorization: Bearer <secret>`. */
export function verifyBearerSecret(
  authorizationHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorizationHeader) return false;

  const expected = `Bearer ${secret}`;
  if (authorizationHeader.length !== expected.length) return false;

  return timingSafeEqual(
    Buffer.from(authorizationHeader),
    Buffer.from(expected),
  );
}

export function verifyRequestBearerSecret(
  request: Request,
  secret: string | undefined,
): boolean {
  return verifyBearerSecret(request.headers.get("authorization"), secret);
}
