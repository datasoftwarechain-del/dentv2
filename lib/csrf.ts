import { NextRequest, NextResponse } from "next/server";

/**
 * Validates CSRF token using the double-submit cookie pattern.
 * The token must appear both in the request cookie AND the x-csrf-token header.
 * Returns null if valid, or a 403 NextResponse if invalid.
 */
export function validateCSRF(request: NextRequest): NextResponse | null {
  // Skip safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;

  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get("csrf_token")?.value;

  if (!headerToken || !cookieToken || !timingSafeEqual(headerToken, cookieToken)) {
    return NextResponse.json(
      { error: "Token CSRF inválido" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
