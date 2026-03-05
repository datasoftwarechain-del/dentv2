"use client";

import { formatSimpleDate, formatNumber } from "@/lib/date-utils";
import { Building2, User, Calendar, Package, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

import { formatWorkType } from "@/lib/work-types";

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
  const hasTax = invoice.tax_amount > 0;
  const showBalance = balanceBefore !== undefined && balanceAfter !== undefined;

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
              <span className="font-bold text-[#044c64] text-base">{invoice.lab_org?.name || "—"}</span>
            </div>
          </div>
          <div className="bg-white px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#09919b] mb-2">
              {isDentist ? "Clínica" : "Para"}
            </p>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#09919b] shrink-0" />
              <span className="font-bold text-[#044c64] text-base">{invoice.dentist_org?.name || "—"}</span>
            </div>
          </div>
        </div>

        {/* Work details */}
        <div className="border border-[#b0dde0]/50 rounded-xl overflow-hidden">
          <div className="bg-slate-600 px-5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-200">
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
            {(invoice.order_items?.[0]?.catalog_item?.name || invoice.work_type) && (
              <div className="bg-white px-5 py-4">
                <p className="text-[10px] text-[#09919b] font-semibold uppercase tracking-wider mb-1">Tipo de Trabajo</p>
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-[#09919b]" />
                  <span className="font-bold text-[#044c64] text-sm">
                    {invoice.order_items?.[0]?.catalog_item?.name || formatWorkType(invoice.work_type)}
                  </span>
                </div>
              </div>
            )}
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
            <div className="bg-slate-600 px-5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-200">
                Detalle de Trabajos
              </p>
            </div>
            <div className="divide-y divide-[#b0dde0]/20">
              {invoice.order_items.map((item) => {
                const itemName = item.catalog_item?.name || formatWorkType(item.work_type);
                const basePrice = item.catalog_item?.base_price ?? 0;
                const extras: { name: string; price: number; qty?: number }[] =
                  Array.isArray(item.selected_extras) ? item.selected_extras : [];
                const qty = item.quantity > 1 ? item.quantity : null;
                return (
                  <div key={item.id} className="bg-white px-5 py-4">
                    <div className="flex justify-between items-baseline gap-4">
                      <span className="font-bold text-[#044c64] text-sm">
                        {itemName}{qty ? ` ×${qty}` : ""}
                      </span>
                      <span className="font-semibold text-[#044c64] text-sm tabular-nums shrink-0">
                        ${formatNumber(basePrice)}
                      </span>
                    </div>
                    {extras.map((extra, i) => {
                      const extraQty = extra.qty ?? 1;
                      const extraTotal = extra.price * extraQty;
                      return (
                        <div key={i} className="flex justify-between items-baseline mt-1.5 gap-4">
                          <span className="text-xs text-slate-500 pl-3">
                            + {extra.name}{extraQty > 1 ? ` ×${extraQty}` : ""}
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums shrink-0">
                            ${formatNumber(extraTotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Amount breakdown */}
        <div className="border border-[#b0dde0]/50 rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-6 py-3.5 bg-white border-b border-[#b0dde0]/30">
            <span className="text-sm text-slate-500 font-medium">Subtotal</span>
            <span className="text-sm font-semibold text-slate-700">${formatNumber(invoice.subtotal || invoice.total)}</span>
          </div>
          {hasTax && (
            <div className="flex justify-between items-center px-6 py-3.5 bg-white border-b border-[#b0dde0]/30">
              <span className="text-sm text-slate-500 font-medium">
                IVA{invoice.tax_rate ? ` (${invoice.tax_rate}%)` : ""}
              </span>
              <span className="text-sm font-semibold text-slate-700">${formatNumber(invoice.tax_amount)}</span>
            </div>
          )}
          {/* Total row — white text on dark teal */}
          <div className="flex justify-between items-center px-6 py-4 bg-[#044c64]">
            <span className="text-sm font-bold text-white/70 uppercase tracking-widest">Total</span>
            <span className="text-2xl font-black text-white tabular-nums tracking-tight">
              ${formatNumber(invoice.total)}
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
