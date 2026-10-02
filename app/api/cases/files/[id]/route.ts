/**
 * [046] Descarga de un archivo de caso, por enlace firmado.
 *
 * El bucket `case-files` dejó de ser público: guardaba escaneos y fotos de
 * pacientes con `public=true`, abiertos para cualquiera que tuviera la URL.
 * Ahora la ruta vive en `case_files.storage_path` y el enlace se firma acá.
 *
 * El permiso NO se decide en este archivo: se lee la fila con la sesión del
 * usuario, así que la decide la RLS de `case_files` (quien pertenezca a la
 * clínica o al laboratorio de esa orden). Si la fila no es suya, no existe
 * para él y la respuesta es 404 — no 403, que confirmaría que el id existe.
 *
 * El enlace dura 5 minutos, el mismo criterio que el módulo de diseño usa
 * para dato clínico.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Con la sesión del usuario: la RLS de case_files decide si la ve.
  const { data: file, error } = await supabase
    .from("case_files")
    .select("storage_path, file_name")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logger.error("[case-files] lookup:", error.message);
    return NextResponse.json({ error: "No se pudo abrir el archivo." }, { status: 500 });
  }
  if (!file?.storage_path) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from("case-files")
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: file.file_name ?? undefined,
    });

  if (signError || !signed?.signedUrl) {
    logger.error("[case-files] sign:", signError?.message);
    return NextResponse.json({ error: "No se pudo abrir el archivo." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
