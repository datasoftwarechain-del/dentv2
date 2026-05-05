"use client";

import { formatSimpleDate, formatNumber } from "@/lib/date-utils";
import { Building2, User, Calendar, Package, CheckCircle2, Clock, XCircle, AlertTriangle, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

import { formatWorkType } from "@/lib/work-types";
import { InvoiceItemRow } from "./invoice-item-row";
import { computeInvoiceTotals } from "@/lib/invoice-totals";

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

interface InvoiceDetailProps {
  invoice: {
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
    /**
     * true = factura nueva, total/subtotal son recalculables desde items.
     * false/undefined = factura histórica, montos persistidos son fuente
     * de verdad y se muestran verbatim.
     */
    totals_strict?: boolean;
    /**
     * true = el monto persistido fue ajustado manualmente y no debe
     * recalcularse desde items, aún cuando totals_strict=true. Se muestra
     * el persistido con badge "Ajustado manualmente" y, debajo, el
     * subtotal informativo desde items para auditoría.
     */
    manually_overridden?: boolean;
  };
  isDentist: boolean;
  className?: string;
  /** Saldo de la cuenta ANTES de emitir esta factura */
  balanceBefore?: number;
  /** Saldo de la cuenta DESPUÉS de emitir esta factura */
  balanceAfter?: number;
}

const statusConfig: Record<string, { label: string; icon: any; bg: string; text: string; border: string }> = {
  pending:   { label: "Pendiente",  icon: Clock,        bg: "bg-[#e0f4f6]",  text: "text-[#09919b]",  border: "border-[#b0dde0]"  },
  paid:      { label: "Pagada",     icon: CheckCircle2, bg: "bg-secondary/[0.08]", text: "text-secondary", border: "border-secondary/25" },
  overdue:   { label: "Vencida",    icon: XCircle,      bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-200"   },
  cancelled: { label: "Cancelada",  icon: XCircle,      bg: "bg-slate-100",  text: "text-slate-500",   border: "border-slate-200"  },
};

export function InvoiceDetail({ invoice, isDentist, className, balanceBefore, balanceAfter }: InvoiceDetailProps) {
  const status = statusConfig[invoice.status] || statusConfig["pending"];
  const StatusIcon = status.icon;
  const showBalance = balanceBefore !== undefined && balanceAfter !== undefined;

  // Supabase returns FK joins as arrays — normalize to single object
  const labOrg  = Array.isArray(invoice.lab_org)     ? invoice.lab_org[0]     : invoice.lab_org;
  const dentOrg = Array.isArray(invoice.dentist_org) ? invoice.dentist_org[0] : invoice.dentist_org;

  // Decidir totales mostrados según totals_strict + manually_overridden.
  // - Histórica (totals_strict=false/undefined) → persistido verbatim.
  // - Strict + override → persistido (con detalle informativo del recalc).
  // - Strict sin override + items → recalcular desde items + extras.
  // - Strict sin items (manual) → persistido.
  const isStrict = invoice.totals_strict === true;
  const isOverride = invoice.manually_overridden === true;
  const hasItems = !!invoice.order_items && invoice.order_items.length > 0;

  // Recalc "vivo" — usado como total cuando NO hay override.
  const recomputed = (isStrict && hasItems && !isOverride)
    ? computeInvoiceTotals(invoice.order_items!, invoice.tax_rate ?? 0)
    : null;

  // Recalc "informativo" — solo para mostrar subtotal-desde-items en facturas
  // ajustadas a mano. No se usa como total.
  const informationalRecalc = (isStrict && hasItems && isOverride)
    ? computeInvoiceTotals(invoice.order_items!, invoice.tax_rate ?? 0)
    : null;

  const displayedSubtotal = recomputed?.subtotal ?? (invoice.subtotal || invoice.total);
  const displayedTaxAmount = recomputed?.taxAmount ?? invoice.tax_amount;
  const displayedTotal = recomputed?.total ?? invoice.total;
  const hasTax = displayedTaxAmount > 0;

  // Discrepancia entre persistido y recalculado (solo aplica a strict con items
  // SIN override — un override es una discrepancia intencional, no un drift).
  const persistedTotal = Number(invoice.total) || 0;
  const recalcTotal = recomputed?.total ?? null;
  const hasDiscrepancy =
    isStrict && hasItems && !isOverride && recalcTotal !== null &&
    Math.abs(persistedTotal - recalcTotal) > 0.01;

  if (hasDiscrepancy && typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(
      `[InvoiceDetail] Discrepancia en factura ${invoice.invoice_number}: persistido=${persistedTotal} recalculado=${recalcTotal}`,
    );
  }

  return (
    <div className={cn("rounded-2xl overflow-hidden shadow-xl border border-[#b0dde0]/40 bg-white", className)}>

      {/* ── Branded header ─────────────────────────────────────── */}
      <div className="bg-[#044c64] px-8 py-6 flex items-start justify-between relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-30px] right-[-30px] h-44 w-44 rounded-full bg-[#43eada]/8 pointer-events-none" />
        <div className="absolute bottom-[-40px] right-20 h-28 w-28 rounded-full bg-[#43eada]/5 pointer-events-none" />

        <div className="relative">
          {/* Brand row: logo + name */}
          <div className="flex items-center gap-2.5 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DigitalDent" className="h-8 w-8 rounded-lg object-cover" />
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-0.5 rounded-full bg-[#43eada]" />
              <span className="text-white/90 font-bold text-sm tracking-widest uppercase leading-none">
                Digital<span className="text-[#43eada]">Dent</span>
              </span>
            </div>
          </div>
          {/* Invoice label */}
          <h2 className="text-4xl font-black text-white tracking-tight leading-none">FACTURA</h2>
          <p className="text-[#43eada] font-mono font-semibold text-sm mt-1.5 tracking-wider">
            #{invoice.invoice_number}
          </p>
        </div>

        {/* Status badge */}
        <div className={cn(
          "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-xs font-bold uppercase tracking-wider mt-1",
          status.bg, status.text, status.border
        )}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </div>
      </div>

      {/* ── Teal accent strip ──────────────────────────────────── */}
      <div className="h-1 bg-gradient-to-r from-[#09919b] via-[#43eada] to-[#09919b]" />

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="px-8 py-7 space-y-7">

        {/* From / To */}
        <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden border border-[#b0dde0]/50">
          <div className="bg-[#f0fafb] px-6 py-5 border-r border-[#b0dde0]/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#09919b] mb-2">
              {isDentist ? "Laboratorio" : "De"}
            </p>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#09919b] shrink-0" />
              <span className="font-bold text-[#044c64] text-base">{labOrg?.name || "—"}</span>
            </div>
          </div>
          <div className="bg-white px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#09919b] mb-2">
              {isDentist ? "Clínica" : "Para"}
            </p>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#09919b] shrink-0" />
              <span className="font-bold text-[#044c64] text-base">{dentOrg?.name || "—"}</span>
            </div>
          </div>
        </div>

        {/* Work details */}
        <div className="border border-[#b0dde0]/50 rounded-xl overflow-hidden">
          <div className="bg-[#044c64] px-5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#43eada]">
              Detalles del Trabajo
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#b0dde0]/30">
            {invoice.patient_name && (
              <div className="bg-white px-5 py-4">
                <p className="text-[10px] text-[#09919b] font-semibold uppercase tracking-wider mb-1">Paciente</p>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-[#09919b]" />
                  <span className="font-bold text-[#044c64] text-sm">{invoice.patient_name}</span>
                </div>
              </div>
            )}
            {(() => {
              // Mostramos solo el nombre del producto del arancel (catálogo).
              // El work_type interno (ej. "Prótesis Removible") quedaba como
              // "Clasificación" debajo y confundía: "Terminacion de 6 a 10"
              // no es prótesis removible aunque comparta enum interno. Si la
              // factura no tiene catálogo (manual), caemos al work_type
              // formateado como única etiqueta.
              const firstItem = invoice.order_items?.[0];
              const catalogName = firstItem?.catalog_item?.name || null;
              const fallback = invoice.work_type ? formatWorkType(invoice.work_type) : null;
              const label = catalogName || fallback;
              if (!label) return null;
              return (
                <div className="bg-white px-5 py-4">
                  <p className="text-[10px] text-[#09919b] font-semibold uppercase tracking-wider mb-1">Tipo de Trabajo</p>
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-[#09919b]" />
                    <span className="font-bold text-[#044c64] text-sm">{label}</span>
                  </div>
                </div>
              );
            })()}
            {invoice.delivery_date && (
              <div className="bg-white px-5 py-4">
                <p className="text-[10px] text-[#09919b] font-semibold uppercase tracking-wider mb-1">Fecha de Entrega</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#09919b]" />
                  <span className="font-bold text-[#044c64] text-sm">{formatSimpleDate(invoice.delivery_date)}</span>
                </div>
              </div>
            )}
            <div className="bg-white px-5 py-4">
              <p className="text-[10px] text-[#09919b] font-semibold uppercase tracking-wider mb-1">Fecha de Emisión</p>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#09919b]" />
                <span className="font-bold text-[#044c64] text-sm">{formatSimpleDate(invoice.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line items breakdown */}
        {invoice.order_items && invoice.order_items.length > 0 && (
          <div className="border border-[#b0dde0]/50 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#044c64] to-[#09919b] px-5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#43eada]">
                Detalle de Trabajos
              </p>
            </div>
            <div className="divide-y divide-[#b0dde0]/20">
              {invoice.order_items.map((item) => (
                <InvoiceItemRow key={item.id} item={item} strictMode={isStrict} />
              ))}
            </div>
          </div>
        )}

        {/* Amount breakdown */}
        <div className="border border-[#b0dde0]/50 rounded-xl overflow-hidden">
          {hasDiscrepancy && (
            <div className="flex items-start gap-2 px-6 py-3 bg-amber-50 border-b border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-semibold">Total recalculado desde ítems</p>
                <p className="text-amber-800">
                  Persistido: ${formatNumber(persistedTotal)} · Recalculado: ${formatNumber(recalcTotal!)}.
                  Si los ítems cambiaron después de emitir, guardá la factura para sincronizar.
                </p>
              </div>
            </div>
          )}
          {/* Línea informativa: subtotal desde ítems cuando hay override manual.
              Auditoría: deja ver qué saldría del recálculo aunque el total cobrado
              sea otro. Tachado en gris para que no compita con el total cobrado. */}
          {isOverride && informationalRecalc && (
            <div className="flex justify-between items-center px-6 py-2 bg-slate-50/60 border-b border-[#b0dde0]/30">
              <span className="text-[11px] text-slate-400 font-medium">
                Subtotal desde ítems (informativo)
              </span>
              <span className="text-[11px] text-slate-400 line-through tabular-nums">
                ${formatNumber(informationalRecalc.subtotal)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center px-6 py-3.5 bg-white border-b border-[#b0dde0]/30">
            <span className="text-sm text-slate-500 font-medium">
              {isOverride ? "Subtotal cobrado" : "Subtotal"}
            </span>
            <span className="text-sm font-semibold text-slate-700">${formatNumber(displayedSubtotal)}</span>
          </div>
          {hasTax && (
            <div className="flex justify-between items-center px-6 py-3.5 bg-white border-b border-[#b0dde0]/30">
              <span className="text-sm text-slate-500 font-medium">
                IVA{invoice.tax_rate ? ` (${invoice.tax_rate}%)` : ""}
              </span>
              <span className="text-sm font-semibold text-slate-700">${formatNumber(displayedTaxAmount)}</span>
            </div>
          )}
          {/* Total row — white text on dark teal */}
          <div className="flex justify-between items-center px-6 py-4 bg-[#044c64]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white/70 uppercase tracking-widest">
                {isOverride ? "Total cobrado" : "Total"}
              </span>
              {isOverride && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
                  <PencilLine className="h-2.5 w-2.5" />
                  Ajustado manualmente
                </span>
              )}
            </div>
            <span className="text-2xl font-black text-white tabular-nums tracking-tight">
              ${formatNumber(displayedTotal)}
            </span>
          </div>
        </div>

        {/* Balance before / after — only when provided */}
        {showBalance && (
          <div className="border border-[#b0dde0]/50 rounded-xl overflow-hidden">
            <div className="bg-[#f0fafb] px-5 py-2.5 border-b border-[#b0dde0]/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#09919b]">
                Estado de Cuenta
              </p>
            </div>
            <div className="divide-y divide-[#b0dde0]/30">
              <div className="flex justify-between items-center px-6 py-3.5 bg-white">
                <span className="text-sm text-slate-500 font-medium">Saldo anterior</span>
                <span className="text-sm font-semibold text-slate-700">${formatNumber(balanceBefore!)}</span>
              </div>
              <div className="flex justify-between items-center px-6 py-3.5 bg-white">
                <span className="text-sm text-slate-500 font-medium">Este cargo (+)</span>
                <span className="text-sm font-semibold text-[#09919b]">+${formatNumber(invoice.total)}</span>
              </div>
              <div className="flex justify-between items-center px-6 py-3.5 bg-[#044c64]">
                <span className="text-sm font-bold text-white/70 uppercase tracking-widest">Saldo Total</span>
                <span className="text-lg font-black text-white tabular-nums">${formatNumber(balanceAfter!)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="px-5 py-4 rounded-xl bg-slate-50 border-l-4 border-[#09919b]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#09919b] mb-1.5">Notas</p>
            <p className="text-sm text-slate-600 leading-relaxed">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="px-8 py-4 bg-[#f0fafb] border-t border-[#b0dde0]/40 flex items-center justify-between">
        <span className="text-[10px] text-[#09919b] font-semibold tracking-wider uppercase">
          DigitalDent · Plataforma de Gestión Dental
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {new Date().toLocaleDateString("es-ES")}
        </span>
      </div>
    </div>
  );
}
