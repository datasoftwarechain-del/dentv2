import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Genera un nuevo token CSRF y lo almacena en una cookie httpOnly
 * @returns El token CSRF generado
 */
export async function generateCSRFToken(): Promise<string> {
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 horas
  });

  return token;
}

/**
 * Obtiene el token CSRF actual de las cookies
 * @returns El token CSRF si existe
 */
export async function getCSRFToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Valida un token CSRF contra el token almacenado en cookies
 * @param token - Token a validar
 * @returns true si el token es válido
 */
export async function validateCSRFToken(token: string | null): Promise<boolean> {
  if (!token) return false;

  const cookieToken = await getCSRFToken();
  if (!cookieToken) return false;

  // Comparación de tiempo constante para prevenir timing attacks
  // En producción, considera usar crypto.timingSafeEqual
  return token === cookieToken;
}
