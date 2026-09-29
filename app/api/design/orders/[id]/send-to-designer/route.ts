/**
 * [046] Despachar un caso a un diseñador, a mano.
 *
 * El moderador elige a quién. La mecánica (token, correo, estado,
 * bitácora) vive en `despacharCaso`, compartida con el bot: si estuviera
 * duplicada acá, habría dos implementaciones de la regla más delicada del
 * módulo y solo una se arreglaría cuando apareciera un problema.
 *
 * Lo que SÍ decide esta ruta, y el bot no necesita, es el permiso: solo el
 * estudio y solo con manage_design_queue, porque repartir un caso es
 * asignar trabajo, no mirarlo.
 *
 * **Un caso, un diseñador.** `design_dispatches` tiene un índice único
 * parcial que impide dos despachos abiertos sobre la misma orden.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { resolveDesignAccess } from "@/lib/design/access";
import { isEmailConfigured } from "@/lib/email";
import { despacharCaso } from "@/lib/design/dispatch/run";

const SendSchema = z.object({
  designer_id: z.string().uuid("Elegí un diseñador"),
  /** Adjuntar enlaces a los escaneos del cliente. Por defecto sí. */
  include_files: z.boolean().default(true),
});

export async function POST(
  httpRequest: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(httpRequest);
  if (csrfError) return csrfError;

  const { id } = await params;
  const { data: body, error: bodyError } = await validateBody(httpRequest, SendSchema);
  if (bodyError) return bodyError;

  const { access, error } = await resolveDesignAccess(id);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  if (access.side !== "studio") {
    return NextResponse.json({ error: "Solo el estudio reparte casos." }, { status: 403 });
  }
  if (access.isCollaborator && !access.permissions?.manage_design_queue) {
    return NextResponse.json({ error: "No tenés permiso para repartir casos." }, { status: 403 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "El envío de correo no está configurado. Definí RESEND_API_KEY y EMAIL_FROM en el servidor." },
      { status: 503 },
    );
  }

  const resultado = await despacharCaso(createAdminClient(), {
    orderId: id,
    applicationId: body.designer_id,
    actorId: access.userId,
    incluirArchivos: body.include_files,
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || httpRequest.nextUrl.origin,
  });

  if (!resultado.ok) {
    const status =
      resultado.codigo === "ya_despachado" ? 409
      : resultado.codigo === "sin_candidato" ? 422
      : resultado.codigo === "sin_intentos" ? 409
      : resultado.codigo === "envio_fallido" ? 502
      : 500;
    return NextResponse.json({ error: resultado.motivo }, { status });
  }

  return NextResponse.json({
    data: { sent: resultado.disenador, dispatch_id: resultado.dispatchId },
  });
}
