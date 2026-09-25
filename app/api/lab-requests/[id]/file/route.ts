/**
 * [040_lab_requests] Confirmación de subida (pública).
 *
 * El navegador la llama después del PUT contra la URL firmada. El
 * servidor NO confía en el aviso: lista el bucket y recién si el objeto
 * existe marca file_status='uploaded'. Quien no conoce el UUID de la
 * solicitud no puede llamarla, y aunque la llame, no puede fabricar un
 * archivo que no está.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { logger } from "@/lib/logger";
import { LAB_REQUEST_BUCKET } from "@/lib/lab-requests/files";

const ConfirmSchema = z.object({
  storage_path: z.string().min(3).max(400),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  const { data: body, error } = await validateBody(request, ConfirmSchema);
  if (error) return error;

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("lab_requests")
    .select("id, request_number, storage_path, file_status, status")
    .eq("id", id)
    .maybeSingle();

  // La ruta tiene que ser exactamente la que el servidor emitió.
  if (!row || row.storage_path !== body.storage_path || row.status !== "pending_review") {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (row.file_status === "uploaded") {
    return NextResponse.json({ data: { file_status: "uploaded" } });
  }

  const slash = body.storage_path.indexOf("/");
  const folder = body.storage_path.slice(0, slash);
  const fileName = body.storage_path.slice(slash + 1);

  const { data: listed, error: listError } = await admin.storage
    .from(LAB_REQUEST_BUCKET)
    .list(folder, { search: fileName });

  if (listError) {
    logger.error("[lab-requests] list:", listError.message);
    return NextResponse.json({ error: "No se pudo verificar el archivo." }, { status: 500 });
  }

  const exists = (listed ?? []).some((o) => o.name === fileName);
  if (!exists) {
    return NextResponse.json(
      { error: "El archivo no llegó al almacenamiento. Reintentá la subida." },
      { status: 409 },
    );
  }

  const { error: updateError } = await admin
    .from("lab_requests")
    .update({ file_status: "uploaded" })
    .eq("id", id);

  if (updateError) {
    logger.error("[lab-requests] confirm:", updateError.message);
    return NextResponse.json({ error: "No se pudo confirmar el archivo." }, { status: 500 });
  }

  return NextResponse.json({ data: { file_status: "uploaded" } });
}
