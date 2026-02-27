import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import DOMPurify from "dompurify";

export interface StatementTransaction {
  id: string;
  date: string;
  type: "invoice" | "payment" | "charge";
  description: string;
  patient_name?: string | null;
  debit: number;
  credit: number;
  balance: number;
}

function sanitize(text: string | null | undefined): string {
  if (!text) return "";
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

function fmtDate(date: string): string {
  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtNum(num: number): string {
  return num.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildHTML(params: {
  transactions: StatementTransaction[];
  clientName: string;
  dateFrom?: string;
  dateTo?: string;
  finalBalance: number;
}): HTMLElement {
  const { transactions, clientName, dateFrom, dateTo, finalBalance } = params;

  const totalDebit  = transactions.reduce((s, t) => s + t.debit,  0);
  const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);

  const periodText =
    dateFrom || dateTo
      ? `${dateFrom ? fmtDate(dateFrom) : "Inicio"} — ${dateTo ? fmtDate(dateTo) : "Hoy"}`
      : "Período completo";

  const rows = transactions
    .map(
      (t, i) => `
      <tr style="border-bottom:1px solid #f1f5f9;background:${i % 2 === 0 ? "#ffffff" : "#fafafa"}">
        <td style="padding:9px 14px;color:#475569;white-space:nowrap;font-size:11px">${fmtDate(t.date)}</td>
        <td style="padding:9px 14px;color:#1e293b;font-weight:500;font-size:11px;max-width:260px">${sanitize(t.description)}</td>
        <td style="padding:9px 14px;color:#475569;font-size:11px">${sanitize(t.patient_name || "—")}</td>
        <td style="padding:9px 14px;text-align:right;font-weight:600;color:${t.debit > 0 ? "#1e293b" : "#cbd5e1"};font-size:11px">
          ${t.debit > 0 ? `+$${fmtNum(t.debit)}` : "—"}
        </td>
        <td style="padding:9px 14px;text-align:right;font-weight:600;color:${t.credit > 0 ? "#059669" : "#cbd5e1"};font-size:11px">
          ${t.credit > 0 ? `−$${fmtNum(t.credit)}` : "—"}
        </td>
        <td style="padding:9px 14px;text-align:right;font-weight:700;color:${t.balance > 0 ? "#0f172a" : "#059669"};font-size:11px">
          $${fmtNum(Math.abs(t.balance))}
        </td>
      </tr>`
    )
    .join("");

  const container = document.createElement("div");
  container.style.cssText = `
    width: 900px;
    background: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    padding: 0;
    box-sizing: border-box;
  `;

  container.innerHTML = DOMPurify.sanitize(`
    <div style="background:#044c64;padding:28px 40px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="margin-bottom:12px">
          <span style="color:white;font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase">
            DIGITAL<span style="color:#43eada">DENT</span>
          </span>
        </div>
        <h1 style="color:white;font-size:26px;font-weight:900;margin:0 0 4px 0;letter-spacing:-0.5px">ESTADO DE CUENTA</h1>
        <p style="color:#43eada;font-size:13px;font-weight:700;margin:0;letter-spacing:0.5px">${sanitize(clientName)}</p>
      </div>
      <div style="text-align:right">
        <p style="color:rgba(255,255,255,0.55);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 3px 0">Generado el</p>
        <p style="color:white;font-size:13px;font-weight:700;margin:0">${new Date().toLocaleDateString("es-ES")}</p>
      </div>
    </div>

    <div style="height:4px;background:linear-gradient(90deg,#09919b,#43eada,#09919b)"></div>

    <div style="display:flex;border-bottom:1px solid #e2e8f0">
      <div style="flex:1;padding:14px 32px;background:#f0fafb;border-right:1px solid #e2e8f0">
        <p style="font-size:9px;color:#09919b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 3px 0">Cliente</p>
        <p style="font-size:14px;font-weight:800;color:#044c64;margin:0">${sanitize(clientName)}</p>
      </div>
      <div style="flex:1;padding:14px 32px;background:white;border-right:1px solid #e2e8f0">
        <p style="font-size:9px;color:#09919b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 3px 0">Período</p>
        <p style="font-size:13px;font-weight:700;color:#044c64;margin:0">${sanitize(periodText)}</p>
      </div>
      <div style="flex:1;padding:14px 32px;background:#f0fafb">
        <p style="font-size:9px;color:#09919b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 3px 0">Movimientos</p>
        <p style="font-size:14px;font-weight:800;color:#044c64;margin:0">${transactions.length}</p>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
          <th style="padding:11px 14px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b">Fecha</th>
          <th style="padding:11px 14px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b">Descripción</th>
          <th style="padding:11px 14px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b">Paciente</th>
          <th style="padding:11px 14px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b">Cargo</th>
          <th style="padding:11px 14px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b">Abono</th>
          <th style="padding:11px 14px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b">Balance</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f0fafb;border-top:2px solid #09919b">
          <td colspan="3" style="padding:13px 14px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b">
            Totales del período
          </td>
          <td style="padding:13px 14px;text-align:right;font-size:14px;font-weight:800;color:#0f172a">$${fmtNum(totalDebit)}</td>
          <td style="padding:13px 14px;text-align:right;font-size:14px;font-weight:800;color:#059669">$${fmtNum(totalCredit)}</td>
          <td style="padding:13px 14px;text-align:right">
            <span style="display:inline-block;background:#044c64;color:white;padding:5px 14px;border-radius:6px;font-size:14px;font-weight:900">
              $${fmtNum(Math.abs(finalBalance))}
            </span>
          </td>
        </tr>
      </tfoot>
    </table>

    <div style="padding:14px 40px;background:#f0fafb;border-top:1px solid #b0dde0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:9px;color:#09919b;font-weight:700;letter-spacing:1px;text-transform:uppercase">DigitalDent · Plataforma de Gestión Dental</span>
      <span style="font-size:9px;color:#94a3b8;font-family:monospace">${new Date().toLocaleDateString("es-ES")}</span>
    </div>
  `);

  return container;
}

export async function exportAccountStatementToPDF(params: {
  transactions: StatementTransaction[];
  clientName: string;
  dateFrom?: string;
  dateTo?: string;
  finalBalance: number;
}): Promise<void> {
  const container = buildHTML(params);
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    document.body.removeChild(container);

    const imgW = canvas.width / 2;
    const imgH = canvas.height / 2;

    const pdf = new jsPDF({
      orientation: imgW > imgH ? "landscape" : "portrait",
      unit: "px",
      format: [imgW, imgH],
    });

    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);

    const slug = params.clientName.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
    pdf.save(`Estado_de_Cuenta_${slug}_${new Date().toISOString().split("T")[0]}.pdf`);
  } catch (err) {
    if (container.parentNode) document.body.removeChild(container);
    throw err;
  }
}
