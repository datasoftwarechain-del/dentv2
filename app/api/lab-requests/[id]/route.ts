/**
 * [040_lab_requests] Detalle y rechazo de una solicitud (laboratorio).
 *
 *   GET   → la solicitud + URL firmada de descarga del archivo (5 min)
 *   PATCH → { action: "reject", reason } cierra la solicitud sin orden
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { resolveLabRequestAccess } from "@/lib/lab-requests/access";
import { LAB_REQUEST_BUCKET, LAB_REQUEST_SIGNED_URL_TTL } from "@/lib/lab-requests/files";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { access, error } = await resolveLabRequestAccess(id, "view");
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { request } = access;
  let downloadUrl: string | null = null;

  if (request.file_status === "uploaded" && request.storage_path) {
    const supabase = await createClient();
    const { data: signed } = await supabase.storage
      .from(LAB_REQUEST_BUCKET)
      .createSignedUrl(request.storage_path, LAB_REQUEST_SIGNED_URL_TTL, {
        download: request.file_name ?? undefined,
      });
    downloadUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({ data: { ...request, download_url: downloadUrl } });
}

const RejectSchema = z.object({
  action: z.literal("reject"),
  reason: z.string().max(500).nullish(),
});

export async function PATCH(
  httpRequest: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCSRF(httpRequest);
  if (csrfError) return csrfError;

  const { id } = await params;
  const { data: body, error: bodyError } = await validateBody(httpRequest, RejectSchema);
  if (bodyError) return bodyError;

  const { access, error } = await resolveLabRequestAccess(id, "reject");
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  if (access.request.status !== "pending_review") {
    return NextResponse.json(
      { error: "La solicitud ya fue procesada." },
      { status: 409 },
    );
  }

  const supabase = await createClient();
  const { data: updated, error: updateError } = await supabase
    .from("lab_requests")
    .update({
      status: "rejected",
      rejection_reason: body.reason?.trim() || null,
      reviewed_by: access.userId,
    })
    .eq("id", id)
    .eq("status", "pending_review")
    .select("id, status")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "La solicitud ya fue procesada." }, { status: 409 });

  return NextResponse.json({ data: updated });
}
