import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceId, method, email, phone } = body;

    if (!invoiceId || !method) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Determinar destinatario
    const recipientOrg = invoice.dentist_org as any;
    const recipientEmail = email || recipientOrg?.email;
    const recipientPhone = phone;

    if (method === "email") {
      // Enviar por email
      // TODO: Integrar con servicio de email (Resend, SendGrid, etc.)
      // Por ahora, simulamos el envío

      if (!recipientEmail) {
        return NextResponse.json(
          { error: "No email address provided" },
          { status: 400 }
        );
      }

      // Aquí iría la integración con el servicio de email
      // Ejemplo con Resend:
      /*
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: 'facturas@dentlabpro.com',
        to: recipientEmail,
        subject: `Factura #${invoice.invoice_number}`,
        html: generateInvoiceEmailHTML(invoice),
        attachments: [
          {
            filename: `Factura_${invoice.invoice_number}.pdf`,
            content: await generateInvoicePDF(invoice),
          },
        ],
      });
      */

      console.log(`Sending invoice ${invoice.invoice_number} to email: ${recipientEmail}`);

      return NextResponse.json({
        success: true,
        message: "Invoice sent via email",
        recipient: recipientEmail,
      });
    }

    if (method === "whatsapp") {
      // Enviar por WhatsApp
      // TODO: Integrar con WhatsApp Business API
      // Por ahora, retornamos la URL para compartir

      if (!recipientPhone) {
        return NextResponse.json(
          { error: "No phone number provided" },
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
        message: "WhatsApp URL generated",
        url: whatsappUrl,
      });
    }

    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  } catch (error) {
    console.error("Error sending invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
