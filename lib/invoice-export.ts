import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import DOMPurify from "dompurify";

interface Organization {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  work_type: string;
  unit_price: number | null;
  quantity: number;
  selected_extras: { name: string; price: number; qty?: number }[];
  catalog_item: { name: string; base_price: number } | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  tax_rate?: number;
  status: string;
  due_date: string | null;
  created_at: string;
  patient_name?: string | null;
  work_type?: string | null;
  delivery_date?: string | null;
  notes?: string | null;
  dentist_org: Organization | null;
  lab_org: Organization | null;
  order_items?: OrderItem[];
  balanceBefore?: number;
  balanceAfter?: number;
  // [031_invoice_discounts] Descuento persistido (opcional).
  discount_type?: "percent" | "amount" | null;
  discount_value?: number | null;
  discount_amount?: number;
  // [032_orders_delivered_at] Fecha viva en que la orden pasó a delivered.
  // Si está presente, prevalece sobre delivery_date para el PDF.
  lab_order?: { delivered_at: string | null } | { delivered_at: string | null }[] | null;
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
 * Genera HTML temporal de la factura para exportación — DigitalDent brand
 */
function generateInvoiceHTML(invoice: Invoice, isDentist: boolean): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText = `
    width: 800px;
    background: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #0f172a;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 32px rgba(4,76,100,0.15);
  `;

  const statusCfg: Record<string, { label: string; bg: string; text: string; border: string }> = {
    pending:   { label: "Pendiente",  bg: "#e0f4f6",  text: "#09919b", border: "#b0dde0" },
    paid:      { label: "Pagada",     bg: "#dcfce7",  text: "#166534", border: "#86efac" },
    overdue:   { label: "Vencida",    bg: "#fee2e2",  text: "#991b1b", border: "#fca5a5" },
    cancelled: { label: "Cancelada",  bg: "#f1f5f9",  text: "#64748b", border: "#cbd5e1" },
  };
  const st = statusCfg[invoice.status] || statusCfg["pending"];
  const hasTax = invoice.tax_amount > 0;

  container.innerHTML = `
    <!-- HEADER -->
    <div style="background: #044c64; padding: 36px 40px 30px; position: relative; overflow: hidden;">
      <!-- decorative circles -->
      <div style="position: absolute; top: -30px; right: -30px; width: 180px; height: 180px; border-radius: 50%; background: rgba(67,234,218,0.08);"></div>
      <div style="position: absolute; bottom: -40px; right: 80px; width: 120px; height: 120px; border-radius: 50%; background: rgba(67,234,218,0.05);"></div>

      <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative;">
        <div>
          <!-- Brand: logo + name -->
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px;">
            <img src="${window.location.origin}/logo.png" alt="DigitalDent" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;" crossorigin="anonymous" />
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 3px; height: 20px; background: #43eada; border-radius: 2px;"></div>
              <span style="color: rgba(255,255,255,0.9); font-weight: 800; font-size: 13px; letter-spacing: 3px; text-transform: uppercase;">
                Digital<span style="color: #43eada;">Dent</span>
              </span>
            </div>
          </div>
          <!-- Title -->
          <h1 style="margin: 0; font-size: 42px; font-weight: 900; color: white; letter-spacing: -1px; line-height: 1;">
            FACTURA
          </h1>
          <p style="margin: 8px 0 0; font-size: 14px; color: #43eada; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">
            #${sanitize(invoice.invoice_number)}
          </p>
        </div>

        <!-- Status badge -->
        <div style="display: inline-flex; align-items: center; gap: 6px; background: ${st.bg}; color: ${st.text}; border: 1.5px solid ${st.border}; border-radius: 100px; padding: 6px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">
          ${st.label}
        </div>
      </div>
    </div>

    <!-- Accent strip -->
    <div style="height: 4px; background: linear-gradient(to right, #09919b, #43eada, #09919b);"></div>

    <!-- BODY -->
    <div style="padding: 36px 40px; background: white;">

      <!-- From / To -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; border-radius: 12px; overflow: hidden; border: 1.5px solid #d2f2f3; margin-bottom: 28px;">
        <div style="background: #f0fafb; padding: 20px 24px; border-right: 1.5px solid #d2f2f3;">
          <p style="margin: 0 0 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #09919b;">
            ${isDentist ? "Laboratorio" : "De"}
          </p>
          <p style="margin: 0; font-size: 17px; font-weight: 800; color: #044c64;">
            ${sanitize(invoice.lab_org?.name) || "—"}
          </p>
        </div>
        <div style="background: white; padding: 20px 24px;">
          <p style="margin: 0 0 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #09919b;">
            ${isDentist ? "Clínica" : "Para"}
          </p>
          <p style="margin: 0; font-size: 17px; font-weight: 800; color: #044c64;">
            ${sanitize(invoice.dentist_org?.name) || "—"}
          </p>
        </div>
      </div>

      <!-- Work details -->
      <div style="border-radius: 12px; overflow: hidden; border: 1.5px solid #d2f2f3; margin-bottom: 28px;">
        <div style="background: #044c64; padding: 10px 20px;">
          <p style="margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #43eada;">
            Detalles del Trabajo
          </p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #d2f2f3;">
          ${invoice.patient_name ? `
          <div style="background: white; padding: 16px 20px;">
            <p style="margin: 0 0 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #09919b;">Paciente</p>
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #044c64;">${sanitize(invoice.patient_name)}</p>
          </div>
          ` : ""}
          ${invoice.work_type ? `
          <div style="background: white; padding: 16px 20px;">
            <p style="margin: 0 0 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #09919b;">Tipo de Trabajo</p>
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #044c64;">${sanitize(invoice.work_type)}</p>
          </div>
          ` : ""}
          ${(() => {
            // [032_orders_delivered_at] PDF: lee delivered_at vivo si está,
            // fallback al snapshot deprecado para compat con datos preexistentes.
            const lo = Array.isArray(invoice.lab_order)
              ? invoice.lab_order[0]
              : invoice.lab_order;
            const deliveredAt = lo?.delivered_at ?? invoice.delivery_date ?? null;
            if (!deliveredAt) return "";
            return `
          <div style="background: white; padding: 16px 20px;">
            <p style="margin: 0 0 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #09919b;">Fecha de Entrega</p>
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #044c64;">${formatDate(deliveredAt)}</p>
          </div>`;
          })()}
          <div style="background: white; padding: 16px 20px;">
            <p style="margin: 0 0 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #09919b;">Fecha de Emisión</p>
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #044c64;">${formatDate(invoice.created_at)}</p>
          </div>
        </div>
      </div>

      <!-- Order Items -->
      ${invoice.order_items && invoice.order_items.length > 0 ? `
      <div style="border-radius: 12px; overflow: hidden; border: 1.5px solid #d2f2f3; margin-bottom: 28px;">
        <div style="background: #044c64; padding: 10px 20px;">
          <p style="margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #43eada;">
            Detalle de Trabajos
          </p>
        </div>
        ${invoice.order_items.map((item) => {
          const itemName = item.catalog_item?.name || item.work_type;
          // [BLOQUE 1 export fix] basePrice prefiere unit_price (snapshot al
          // emitir) sobre catalog.base_price (vivo, puede haber cambiado).
          const basePrice = item.unit_price ?? item.catalog_item?.base_price ?? 0;
          const extras = Array.isArray(item.selected_extras) ? item.selected_extras : [];
          const extrasTotal = extras.reduce((sum: number, e: any) => sum + e.price * (e.qty ?? 1), 0);
          const itemQty = Number(item.quantity) || 1;
          // [Auditoría 1.4] Línea principal y subtotal del ítem ahora multiplican
          // por qty (paridad con InvoiceItemRow strict). El total de la factura
          // sigue siendo invoice.total persistido — no se recalcula acá.
          const lineAmount = basePrice * itemQty;
          const itemSubtotal = (basePrice + extrasTotal) * itemQty;
          const qtyBadge = itemQty > 1 ? ` ×${itemQty}` : "";
          return `
          <div style="background: white; padding: 16px 20px; border-bottom: 1px solid #e0f4f6;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px;">
              <span style="font-size: 14px; font-weight: 700; color: #044c64;">${sanitize(itemName)}${qtyBadge}</span>
              <span style="font-size: 14px; font-weight: 600; color: #044c64; white-space: nowrap;">$${formatNumber(lineAmount)}</span>
            </div>
            ${extras.length > 0 ? `
            <div style="margin-top: 8px; padding-left: 16px; border-left: 3px solid rgba(67,234,218,0.4);">
              ${extras.map((e: any) => {
                const eQty = e.qty ?? 1;
                // Cada extra se multiplica también por la cantidad del ítem
                // padre (igual que computeItemTotal).
                const extraLineAmount = e.price * eQty * itemQty;
                return `
                <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 4px;">
                  <span style="font-size: 12px; color: #64748b;">+ ${sanitize(e.name)}${eQty > 1 ? ` ×${eQty}` : ""}${itemQty > 1 ? ` × ${itemQty}` : ""}</span>
                  <span style="font-size: 12px; color: #64748b; white-space: nowrap;">$${formatNumber(extraLineAmount)}</span>
                </div>`;
              }).join("")}
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e0f4f6;">
                <span style="font-size: 12px; font-weight: 700; color: #044c64;">Subtotal ítem</span>
                <span style="font-size: 12px; font-weight: 700; color: #044c64; white-space: nowrap;">$${formatNumber(itemSubtotal)}</span>
              </div>
            </div>
            ` : itemQty > 1 ? `
            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e0f4f6;">
              <span style="font-size: 12px; font-weight: 700; color: #044c64;">Subtotal ítem</span>
              <span style="font-size: 12px; font-weight: 700; color: #044c64; white-space: nowrap;">$${formatNumber(itemSubtotal)}</span>
            </div>
            ` : ""}
          </div>`;
        }).join("")}
      </div>
      ` : ""}

      <!-- Amounts -->
      <div style="border-radius: 12px; overflow: hidden; border: 1.5px solid #d2f2f3; margin-bottom: 24px;">
        <!-- Subtotal -->
        <div style="display: flex; justify-content: space-between; padding: 14px 24px; background: white; border-bottom: 1px solid #e0f4f6;">
          <span style="font-size: 13px; color: #64748b; font-weight: 500;">Subtotal</span>
          <span style="font-size: 13px; font-weight: 700; color: #1e293b;">$${formatNumber(invoice.subtotal || invoice.total)}</span>
        </div>
        ${(invoice.discount_amount ?? 0) > 0 ? `
        <!-- [031_invoice_discounts] Descuento aplicado al subtotal -->
        <div style="display: flex; justify-content: space-between; padding: 14px 24px; background: white; border-bottom: 1px solid #e0f4f6;">
          <span style="font-size: 13px; color: #047857; font-weight: 500;">Descuento${
            invoice.discount_type === "percent" && invoice.discount_value != null
              ? ` (${invoice.discount_value}%)`
              : ""
          }</span>
          <span style="font-size: 13px; font-weight: 700; color: #047857;">−$${formatNumber(invoice.discount_amount ?? 0)}</span>
        </div>
        ` : ""}
        ${hasTax ? `
        <div style="display: flex; justify-content: space-between; padding: 14px 24px; background: white; border-bottom: 1px solid #e0f4f6;">
          <span style="font-size: 13px; color: #64748b; font-weight: 500;">IVA</span>
          <span style="font-size: 13px; font-weight: 700; color: #1e293b;">$${formatNumber(invoice.tax_amount)}</span>
        </div>
        ` : ""}
        <!-- Total row branded -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; background: #044c64;">
          <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; color: rgba(255,255,255,0.7);">Total</span>
          <span style="font-size: 30px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">$${formatNumber(invoice.total)}</span>
        </div>
      </div>

      <!-- Balance before / after -->
      ${invoice.balanceBefore !== undefined && invoice.balanceAfter !== undefined ? `
      <div style="border-radius: 12px; overflow: hidden; border: 1.5px solid #d2f2f3; margin-bottom: 24px;">
        <div style="background: #f0fafb; padding: 10px 20px; border-bottom: 1px solid #d2f2f3;">
          <p style="margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #09919b;">Estado de Cuenta</p>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 14px 24px; background: white; border-bottom: 1px solid #e0f4f6;">
          <span style="font-size: 13px; color: #64748b; font-weight: 500;">Saldo anterior</span>
          <span style="font-size: 13px; font-weight: 700; color: #1e293b;">$${formatNumber(invoice.balanceBefore)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 14px 24px; background: white; border-bottom: 1px solid #e0f4f6;">
          <span style="font-size: 13px; color: #64748b; font-weight: 500;">Este cargo (+)</span>
          <span style="font-size: 13px; font-weight: 700; color: #09919b;">+$${formatNumber(invoice.total)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: #044c64;">
          <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; color: rgba(255,255,255,0.7);">Saldo Total</span>
          <span style="font-size: 22px; font-weight: 900; color: #ffffff;">$${formatNumber(invoice.balanceAfter)}</span>
        </div>
      </div>
      ` : ""}

      <!-- Notes -->
      ${invoice.notes ? `
      <div style="padding: 16px 20px; background: #f8fafc; border-left: 4px solid #09919b; border-radius: 4px;">
        <p style="margin: 0 0 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #09919b;">Notas</p>
        <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">${sanitize(invoice.notes)}</p>
      </div>
      ` : ""}
    </div>

    <!-- FOOTER -->
    <div style="background: #f0fafb; border-top: 1.5px solid #d2f2f3; padding: 14px 40px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #09919b;">
        DigitalDent · Plataforma de Gestión Dental
      </span>
      <span style="font-size: 10px; color: #94a3b8; font-family: 'Courier New', monospace;">
        ${new Date().toLocaleDateString("es-ES")}
      </span>
    </div>
  `;

  return container;
}

/**
 * Genera un Blob PNG de la factura (para copiar al portapapeles / WhatsApp)
 */
export async function generateInvoiceBlob(invoice: Invoice, isDentist: boolean): Promise<Blob> {
  const container = generateInvoiceHTML(invoice, isDentist);
  document.body.appendChild(container);

  const canvas = await html2canvas(container, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true,
  });

  document.body.removeChild(container);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo generar la imagen"));
      },
      "image/png",
      1.0
    );
  });
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
