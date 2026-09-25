/**
 * Chip de alcance: Online o Uruguay.
 *
 * El diseño exige que el alcance se comunique por tres canales, no solo
 * por color: ícono (globo / pin + bandera), texto ("Online" /
 * "Uruguay") y forma (relleno para Online, borde punteado para
 * Uruguay). Un daltónico y un lector de pantalla tienen que distinguirlos
 * igual que cualquiera.
 */

import { cn } from "@/lib/utils";
import type { Scope } from "@/content/servicios";

function GlobeIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function PinIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** Bandera de Uruguay simplificada: nueve franjas y el sol en el cantón. */
export function UruguayFlag({ width = 15 }: { width?: number }) {
  const h = Math.round(width * 12 / 18);
  return (
    <svg width={width} height={h} viewBox="0 0 18 12" className="flex-none rounded-[2px] shadow-[0_0_0_1px_rgba(32,80,104,.15)]" aria-hidden="true">
      <rect width="18" height="12" fill="#fff" />
      {[1.33, 4, 6.67, 9.33].map((y) => <rect key={y} y={y} width="18" height="1.33" fill="#0038a8" />)}
      <rect width="6.7" height="6.7" fill="#fff" />
      <circle cx="3.35" cy="3.35" r="1.7" fill="#f2b705" />
    </svg>
  );
}

interface ScopeChipProps {
  scope: Scope;
  /** sm = 24px (cards) · md = 32px (encabezados de bloque) · lg = 36px (bloque 01). */
  size?: "sm" | "md" | "lg";
  /** Texto alternativo al del alcance, p. ej. "Disponible en Uruguay". */
  label?: string;
  className?: string;
}

export function ScopeChip({ scope, size = "sm", label, className }: ScopeChipProps) {
  const ww = scope === "worldwide";
  const text = label ?? (ww ? "Online" : "Uruguay");
  const dims = {
    sm: "h-6 px-2.5 text-[11px] gap-1.5",
    md: "h-8 px-3.5 pl-2.5 text-[12px] gap-2 uppercase tracking-[.06em]",
    lg: "h-9 px-4 pl-3 text-[13px] gap-2 uppercase tracking-[.08em]",
  }[size];
  const icon = size === "sm" ? 13 : size === "md" ? 15 : 17;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap",
        dims,
        ww
          ? "bg-[var(--dd-deep-600)] text-[var(--dd-mist-200)]"
          : "border border-dashed border-[#2f6fa8] bg-white/90 text-[#1f5a8f]",
        className,
      )}
    >
      {ww ? <GlobeIcon size={icon} /> : <PinIcon size={icon} />}
      {!ww && size !== "sm" && <UruguayFlag width={size === "lg" ? 18 : 16} />}
      {!ww && size === "sm" && <UruguayFlag width={15} />}
      {text}
    </span>
  );
}
