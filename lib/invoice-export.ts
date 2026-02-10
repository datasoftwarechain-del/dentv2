import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import DOMPurify from "dompurify";

interface Organization {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
  patient_name?: string | null;
  work_type?: string | null;
  delivery_date?: string | null;
  notes?: string | null;
  dentist_org: Organization | null;
  lab_org: Organization | null;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatNumber(num: number): string {
  return num.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Sanitiza texto para prevenir XSS
 * Remueve todos los tags HTML y solo permite texto plano
 */
function sanitize(text: string | null | undefined): string {
  if (!text) return "";
  // DOMPurify con configuración estricta: sin tags HTML permitidos
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Genera HTML temporal de la factura para exportación
 */
function generateInvoiceHTML(invoice: Invoice, isDentist: boolean): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText = `
    width: 800px;
    padding: 40px;
    background: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #000;
  `;

  container.innerHTML = `
    <div style="margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px;">
      <h1 style="margin: 0; font-size: 32px; font-weight: bold; color: #1e293b;">FACTURA</h1>
      <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">
        Nº: <span style="font-weight: 700; font-family: 'Courier New', monospace; color: #1e293b;">${invoice.invoice_number}</span>
      </p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
      <div>
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">
          ${isDentist ? "LABORATORIO" : "DE"}
        </p>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">
          ${sanitize(invoice.lab_org?.name) || "N/A"}
        </p>
      </div>

      <div>
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">
          ${isDentist ? "CLÍNICA" : "PARA"}
        </p>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">
          ${sanitize(invoice.dentist_org?.name) || "N/A"}
        </p>
      </div>
    </div>

    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
      <p style="margin: 0 0 15px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">
        DETALLES DEL TRABAJO
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        ${invoice.patient_name ? `
        <div>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b; font-weight: 600;">Paciente</p>
          <p style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b;">${sanitize(invoice.patient_name)}</p>
        </div>
        ` : ""}

        ${invoice.work_type ? `
        <div>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b; font-weight: 600;">Tipo de Trabajo</p>
          <p style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b;">${sanitize(invoice.work_type)}</p>
        </div>
        ` : ""}

        ${invoice.delivery_date ? `
        <div>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b; font-weight: 600;">Fecha de Entrega</p>
          <p style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b;">${formatDate(invoice.delivery_date)}</p>
        </div>
        ` : ""}

        <div>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b; font-weight: 600;">Fecha de Emisión</p>
          <p style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b;">${formatDate(invoice.created_at)}</p>
        </div>
      </div>
    </div>

    <div style="border-top: 2px solid #e2e8f0; padding-top: 20px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 14px; color: #64748b;">Subtotal</span>
        <span style="font-size: 14px; font-weight: 600; color: #1e293b;">$${formatNumber(invoice.subtotal)}</span>
      </div>

      ${invoice.tax_amount > 0 ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 14px; color: #64748b;">IVA</span>
        <span style="font-size: 14px; font-weight: 600; color: #1e293b;">$${formatNumber(invoice.tax_amount)}</span>
      </div>
      ` : ""}

      <div style="border-top: 2px solid #e2e8f0; padding-top: 15px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 18px; font-weight: 700; color: #1e293b;">TOTAL</span>
        <span style="font-size: 28px; font-weight: 700; color: #2563eb;">$${formatNumber(invoice.total)}</span>
      </div>
    </div>

    ${invoice.due_date && invoice.status === "pending" ? `
    <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 13px; font-weight: 700; color: #92400e;">
        ⏰ Vence el: ${formatDate(invoice.due_date)}
      </p>
    </div>
    ` : ""}

    <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; margin-top: 20px;">
      <div style="display: inline-block; background: ${
        invoice.status === "paid"
          ? "#dcfce7"
          : invoice.status === "pending"
          ? "#fef3c7"
          : "#fee2e2"
      }; color: ${
        invoice.status === "paid"
          ? "#166534"
          : invoice.status === "pending"
          ? "#92400e"
          : "#991b1b"
      }; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
        ${statusLabels[invoice.status] || invoice.status}
      </div>
    </div>

    ${invoice.notes ? `
    <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-left: 4px solid #94a3b8; border-radius: 4px;">
      <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">
        NOTAS
      </p>
      <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">${sanitize(invoice.notes)}</p>
    </div>
    ` : ""}

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">
        Generado con DentLab Pro • ${new Date().toLocaleDateString("es-ES")}
      </p>
    </div>
  `;

  return container;
}

/**
 * Exporta la factura como PDF optimizado
 */
export async function exportInvoiceToPDF(invoice: Invoice, isDentist: boolean): Promise<void> {
  try {
    // Generar HTML temporal
    const container = generateInvoiceHTML(invoice, isDentist);
    document.body.appendChild(container);

    // Capturar como canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Alta calidad
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });

    // Remover elemento temporal
    document.body.removeChild(container);

    // Crear PDF
    const imgData = canvas.toDataURL("image/jpeg", 0.85); // Comprimir al 85%
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10;

    pdf.addImage(
      imgData,
      "JPEG",
      imgX,
      imgY,
      imgWidth * ratio,
      imgHeight * ratio,
      undefined,
      "FAST" // Compresión rápida
    );

    // Descargar
    pdf.save(`Factura_${invoice.invoice_number}.pdf`);
  } catch (error) {
    console.error("Error exporting PDF:", error);
    throw error;
  }
}

/**
 * Exporta la factura como JPG optimizado
 */
export async function exportInvoiceToJPG(invoice: Invoice, isDentist: boolean): Promise<void> {
  try {
    // Generar HTML temporal
    const container = generateInvoiceHTML(invoice, isDentist);
    document.body.appendChild(container);

    // Capturar como canvas con alta calidad
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });

    // Remover elemento temporal
    document.body.removeChild(container);

    // Convertir a blob optimizado
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
        },
        "image/jpeg",
        0.85 // Calidad 85% para balance entre calidad y tamaño
      );
    });

    // Descargar
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Factura_${invoice.invoice_number}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting JPG:", error);
    throw error;
  }
}
