import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// NOTE: This is per-instance. For multi-region/serverless at scale,
// replace with @upstash/ratelimit + Redis.
const rateMap = new Map<string, { count: number; resetAt: number }>();

const RATE_WINDOW_MS = 60_000; // 1 minute window
const AUTH_LIMIT = 10;          // max 10 auth requests per IP per minute
const API_LIMIT = 120;          // max 120 API requests per IP per minute
// [design-intake] La solicitud publica de diseno crea un usuario y una
// organizacion por llamada. El limite general de 120/min dejaria a un
// script llenar la base en una tarde, asi que lleva el suyo, mas estricto
// que el de auth: pedir un diseno no es algo que se haga cinco veces por
// minuto ni siquiera equivocandose.
const PUBLIC_INTAKE_LIMIT = 3;  // max 3 solicitudes publicas por IP por minuto

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true; // allowed
  }

  if (entry.count >= limit) return false; // blocked

  entry.count++;
  return true; // allowed
}

// Clean up stale entries periodically to avoid memory growth
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return; // every 5 min
  lastCleanup = now;
  for (const [key, entry] of rateMap.entries()) {
    if (entry.resetAt < now) rateMap.delete(key);
  }
}

// ─── Proxy (Next.js 16+ convention, replaces middleware) ─────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  maybeCleanup();

  // Rate limit: auth routes (strict)
  if (pathname.startsWith("/auth/") && request.method === "POST") {
    const key = `auth:${getClientIP(request)}`;
    if (!checkRateLimit(key, AUTH_LIMIT)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Esperá un momento antes de intentar de nuevo." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // [payments] Los webhooks de pago no llevan cookie de CSRF: los manda
  // un servidor, no un navegador. Su autenticacion es la firma, que se
  // valida dentro de la ruta contra el proveedor. Tampoco se les aplica
  // el limite por IP: el proveedor reintenta en rafagas cuando algo
  // falla, y bloquearlo significaria perder un pago ya cobrado.
  if (pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  // Rate limit: solicitud publica de diseno (crea usuario + organizacion)
  if (pathname === "/api/design/request" && request.method === "POST") {
    const key = `intake:${getClientIP(request)}`;
    if (!checkRateLimit(key, PUBLIC_INTAKE_LIMIT)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes seguidas. Esperá un minuto y volvé a intentar." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // Rate limit: API routes
  if (pathname.startsWith("/api/")) {
    const key = `api:${getClientIP(request)}`;
    if (!checkRateLimit(key, API_LIMIT)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá más tarde." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // Supabase session refresh + auth redirect (uses existing proxy logic)
  const response = await updateSession(request);

  // Set CSRF token cookie if not already present
  // httpOnly: false so the useCSRF() hook can read it via document.cookie
  if (!request.cookies.has("csrf_token")) {
    const token = crypto.randomUUID();
    response.cookies.set("csrf_token", token, {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public directory files
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif)).*)",
  ],
};
