import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { validateCSRF } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceId, method, email, phone } = body;

    if (!invoiceId || !method) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        dentist_org:organizations!invoices_dentist_org_id_fkey(id, name, email),
        lab_org:organizations!invoices_lab_org_id_fkey(id, name, email)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Determinar destinatario
    const recipientOrg = invoice.dentist_org as any;
    const recipientEmail = email || recipientOrg?.email;
    const recipientPhone = phone;

    if (method === "email") {
      // TODO: Integrar con servicio de email (Resend, SendGrid, etc.)

      if (!recipientEmail) {
        return NextResponse.json(
          { error: "No se proporcionó dirección de email" },
          { status: 400 }
        );
      }

      console.log(`Sending invoice ${invoice.invoice_number} to email: ${recipientEmail}`);

      return NextResponse.json({
        success: true,
        message: "Factura enviada por email",
        recipient: recipientEmail,
      });
    }

    if (method === "whatsapp") {
      // TODO: Integrar con WhatsApp Business API

      if (!recipientPhone) {
        return NextResponse.json(
          { error: "No se proporcionó número de teléfono" },
          { status: 400 }
        );
      }

      const message = `Hola! Te compartimos la factura #${invoice.invoice_number}
Paciente: ${invoice.patient_name || "N/A"}
Total: $${invoice.total}
Estado: ${invoice.status}

Puedes descargarla desde: [enlace]`;

      const whatsappUrl = `https://wa.me/${recipientPhone}?text=${encodeURIComponent(message)}`;

      return NextResponse.json({
        success: true,
        message: "URL de WhatsApp generada",
        url: whatsappUrl,
      });
    }

    return NextResponse.json({ error: "Método inválido" }, { status: 400 });
  } catch (error) {
    console.error("Error al enviar factura:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
