'use client';

/**
 * Hook para obtener el token CSRF del lado del cliente
 * Lee el token desde las cookies del navegador
 */
export function useCSRF() {
  const getToken = (): string => {
    if (typeof document === 'undefined') return '';

    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='));

    if (!csrfCookie) return '';

    return csrfCookie.split('=')[1] || '';
  };

  return { csrfToken: getToken() };
}
