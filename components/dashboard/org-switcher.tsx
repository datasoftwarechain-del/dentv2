"use client";

/**
 * [org-switcher] Selector de organización del menú.
 *
 * Solo aparece si el usuario pertenece a más de una: con una sola no hay
 * nada que elegir y un desplegable de un item es ruido.
 *
 * Al cambiar hace una navegación dura a /dashboard en vez de router.push:
 * la organización activa cambia lo que devuelve CADA consulta del servidor,
 * y un refresh parcial dejaría media pantalla con datos de la organización
 * anterior. Es el mismo motivo por el que no se puede hacer optimista.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

export interface SwitchableOrg {
  id: string;
  name: string;
  type: string;
}

interface OrgSwitcherProps {
  orgs: SwitchableOrg[];
  currentOrgId: string;
  /** El menú colapsado no tiene ancho para el nombre: se muestra la inicial. */
  isExpanded: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  lab: "Laboratorio",
  dentist: "Consultorio",
  design_studio: "Estudio de diseño",
  dentist_preview: "Vista previa",
};

function csrf(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function OrgSwitcher({ orgs, currentOrgId, isExpanded }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Con una sola organización no hay nada que elegir.
  if (orgs.length < 2) return null;

  const current = orgs.find((o) => o.id === currentOrgId) ?? orgs[0];

  async function switchTo(orgId: string) {
    if (orgId === currentOrgId) {
      setIsOpen(false);
      return;
    }

    setSwitchingTo(orgId);
    setError(null);

    try {
      const response = await fetch("/api/org/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "No se pudo cambiar de organización");
      }

      // Navegación dura: todo lo que hay en pantalla depende de la
      // organización activa, incluido el propio menú.
      window.location.href = "/dashboard";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar");
      setSwitchingTo(null);
    }
  }

  return (
    <div className="relative px-2 pb-2">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title={!isExpanded ? current.name : undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Organización actual: ${current.name}. Cambiar de organización`}
        className={cn(
          "group flex w-full items-center gap-2 rounded-2xl py-2 transition-all duration-200",
          "bg-white/10 text-white/80 hover:bg-white/15 hover:text-white",
          isExpanded ? "px-3" : "justify-center px-2",
        )}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#43eada] text-[11px] font-bold text-[#033d52]"
          aria-hidden="true"
        >
          {current.name.charAt(0).toUpperCase()}
        </span>

        {isExpanded && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[12px] font-medium leading-tight">
                {current.name}
              </span>
              <span className="block truncate text-[10px] leading-tight text-white/50">
                {TYPE_LABELS[current.type] ?? current.type}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
          </>
        )}
      </button>

      {isOpen && (
        <>
          {/* Capta el clic afuera para cerrar */}
          <div
            className="fixed inset-0 z-[55]"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <ul
            role="listbox"
            className="absolute bottom-full left-2 right-2 z-[60] mb-1 overflow-hidden rounded-2xl border border-white/10 bg-[#044c64] py-1 shadow-2xl shadow-black/50"
          >
            {orgs.map((org) => {
              const isCurrent = org.id === currentOrgId;
              const isSwitching = switchingTo === org.id;

              return (
                <li key={org.id} role="option" aria-selected={isCurrent}>
                  <button
                    type="button"
                    onClick={() => switchTo(org.id)}
                    disabled={switchingTo !== null}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                      isCurrent ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                      switchingTo !== null && !isSwitching && "opacity-40",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium leading-tight">
                        {org.name}
                      </span>
                      <span className="block truncate text-[10px] leading-tight text-white/45">
                        {TYPE_LABELS[org.type] ?? org.type}
                      </span>
                    </span>

                    {isSwitching ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#43eada]" />
                    ) : isCurrent ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#43eada]" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {error && isExpanded && (
        <p className="mt-1 px-1 text-[10px] text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
