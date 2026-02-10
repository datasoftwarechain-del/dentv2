import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'
import { generateCSRFToken, validateCSRFToken } from '@/lib/csrf'

export async function proxy(request: NextRequest) {
  // Actualizar sesión de Supabase
  const response = await updateSession(request)

  // Lógica CSRF agregada para seguridad
  const method = request.method.toUpperCase()
  const isStateMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  // Generar token CSRF para requests seguros
  if (!isStateMutating) {
    await generateCSRFToken()
  }

  // Validar CSRF en operaciones de cambio de estado
  if (isStateMutating && isApiRoute) {
    const csrfHeader = request.headers.get('x-csrf-token')
    const isValid = await validateCSRFToken(csrfHeader)

    if (!isValid) {
      console.warn(`[CSRF] Invalid token for ${method} ${request.nextUrl.pathname}`)
      return NextResponse.json(
        { error: 'Token CSRF inválido' },
        { status: 403 }
      )
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
