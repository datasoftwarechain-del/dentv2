import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/api-validation";
import { validateCSRF } from "@/lib/csrf";
import { createAdminClient } from "@/lib/supabase/admin";

const LeadSchema = z.object({
  email:         z.string().email("Email inválido"),
  name:          z.string().max(100).optional(),
  phone:         z.string().max(30).optional(),
  role:          z.enum(["dentist", "lab", "clinic", "other"]).optional(),
  message:       z.string().max(1000).optional(),
  source:        z.enum(["newsletter", "chat"]),
  wants_contact: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  const { data, error } = await validateBody(request, LeadSchema);
  if (error) return error;

  const supabase = createAdminClient();

  const { error: dbError } = await supabase
    .from("public_leads")
    .upsert(
      {
        email:         data.email,
        name:          data.name ?? null,
        phone:         data.phone ?? null,
        role:          data.role ?? null,
        message:       data.message ?? null,
        source:        data.source,
        wants_contact: data.wants_contact,
        updated_at:    new Date().toISOString(),
      },
      {
        onConflict: "email,source",
        ignoreDuplicates: false,
      }
    );

  if (dbError) {
    console.error("[leads] DB error:", dbError.message);
    return NextResponse.json(
      { error: "Error al guardar tu información. Intenta de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
