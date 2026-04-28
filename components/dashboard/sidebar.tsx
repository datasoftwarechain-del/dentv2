"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  FileText,
  Calendar,
  CreditCard,
  Settings,
  Package,
  Building2,
  Menu,
  CalendarClock,
  Scan,
  MessageCircle,
  Lock,
  ShoppingCart,
  Boxes,
  BarChart3,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import type { CollaboratorPermissions, PermissionKey } from "@/lib/permissions";

interface SidebarProps {
  orgType: "dentist" | "lab" | "dentist_preview";
  orgName: string;
  isCollaborator?: boolean;
  permissions?: CollaboratorPermissions | null;
}

/** Paths accessible to dentist_preview accounts without a lock */
const PREVIEW_ALLOWED = [
  "/dashboard",
  "/dashboard/orders",
  "/dashboard/schedule",
  "/dashboard/billing",
];

/** Maps each nav path to the permission key required to see it */
const NAV_PERMISSION_MAP: Record<string, PermissionKey> = {
  "/dashboard/patients":     "view_patients",
  "/dashboard/appointments": "view_appointments",
  "/dashboard/orders":       "view_orders",
  "/dashboard/cases":        "view_cases",
  "/dashboard/schedule":     "view_schedule",
  "/dashboard/kanban":       "view_kanban",
  "/dashboard/billing":      "view_billing",
  "/dashboard/clients":      "view_clients",
  // [BLOQUE 6] Tabs of /dashboard/billing — deep-linked via ?tab=...
  "/dashboard/billing?tab=purchases":  "view_purchases",
  "/dashboard/billing?tab=inventory":  "view_inventory",
  "/dashboard/billing?tab=analytics":  "view_financial_dashboard",
};

const dentistNav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/patients", label: "Pacientes", icon: Users },
  { href: "/dashboard/appointments", label: "Citas", icon: Calendar },
  { href: "/dashboard/orders", label: "Órdenes", icon: FileText },
  { href: "/dashboard/cases", label: "Casos Digitales", icon: Scan },
  { href: "/dashboard/schedule", label: "Agenda Semanal", icon: CalendarClock },
  { href: "/dashboard/billing", label: "Facturacion", icon: CreditCard },
  { href: "/dashboard/settings", label: "Configuracion", icon: Settings },
];

const labNav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/orders", label: "Órdenes", icon: FileText },
  { href: "/dashboard/cases", label: "Casos Digitales", icon: Scan },
  { href: "/dashboard/kanban", label: "Produccion", icon: Package },
  { href: "/dashboard/schedule", label: "Agenda Semanal", icon: CalendarClock },
  { href: "/dashboard/clients", label: "Clinicas", icon: Building2 },
  { href: "/dashboard/billing", label: "Facturacion", icon: CreditCard },
  // [BLOQUE 6] Direct shortcuts to billing tabs.
  { href: "/dashboard/billing?tab=purchases", label: "Compras",  icon: ShoppingCart },
  { href: "/dashboard/billing?tab=inventory", label: "Stock",    icon: Boxes },
  { href: "/dashboard/billing?tab=analytics", label: "Análisis", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Configuracion", icon: Settings },
];

export function Sidebar({ orgType, orgName, isCollaborator = false, permissions = null }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const baseNav = orgType === "lab" ? labNav : dentistNav;

  // Filter nav items for collaborators — only show sections they have access to
  const navItems = isCollaborator && permissions
    ? baseNav.filter((item) => {
        const requiredPerm = NAV_PERMISSION_MAP[item.href];
        if (!requiredPerm) return true; // Dashboard and Settings are always visible
        return !!permissions[requiredPerm];
      })
    : baseNav;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Desktop: expanded on hover. Mobile: expanded when toggled.
  const isExpanded = isMobile ? mobileOpen : isHovered;

  const handleLinkClick = useCallback(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  return (
    <>
      {/* ── Mobile top navigation bar ─────────────────────────────────────── */}
      {/* Replaces the old floating hamburger button. Fixed at top, pushes content down via pt-14 in layout. */}
      {/* Se oculta con slide-up cuando el sidebar está abierto para evitar la duplicación visual del logo */}
      <header className={cn(
        "lg:hidden fixed top-0 inset-x-0 z-[45] h-14 flex items-center justify-between px-4 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm transition-all duration-200",
        mobileOpen ? "-translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      )}>
        {/* Hamburguesa minimalista — solo tres líneas, sin caja */}
        <button
          className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100 active:scale-95 transition-all"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5 text-slate-500" strokeWidth={1.6} />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2" onClick={handleLinkClick}>
          <Image src="/logo.png" alt="DigitalDent" width={26} height={26} className="rounded-lg" />
          <div className="leading-none">
            <span className="text-[14px] font-bold text-[#044c64] tracking-tight">Digital</span>
            <span className="text-[14px] font-bold text-[#09919b] tracking-tight">Dent</span>
          </div>
        </Link>

        <div className="h-9 w-9" aria-hidden="true" />
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed z-50 flex flex-col transition-all duration-300 ease-in-out",
          // Background + gradient for depth
          "bg-gradient-to-b from-[#055570] via-[#044c64] to-[#033d52]",
          // Desktop: floating pill detached from edges
          // Mobile: full-height slide-in with right-only rounding
          isMobile
            ? "inset-y-0 left-0 rounded-r-3xl shadow-2xl shadow-black/40"
            : "top-3 bottom-3 left-3 rounded-[28px] shadow-2xl shadow-black/40 ring-1 ring-white/10",
          // Width transitions
          isMobile ? "w-64" : isHovered ? "w-60" : "w-[68px]",
          // Mobile slide in/out
          isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full")
        )}
        onMouseEnter={() => { if (!isMobile) setIsHovered(true); }}
        onMouseLeave={() => { if (!isMobile) setIsHovered(false); }}
      >
        {/* ── Logo header ── */}
        <div className="flex h-16 shrink-0 items-center overflow-hidden border-b border-white/10 px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 group"
            onClick={handleLinkClick}
          >
            {/* Logo badge — matches the reference's circular icon container */}
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-2xl bg-white/15 transition-all duration-300 ring-1 ring-white/20",
                isExpanded ? "h-9 w-9" : "h-10 w-10"
              )}
            >
              <Image
                src="/logo.png"
                alt="DigitalDent logo"
                width={26}
                height={26}
                className="rounded-xl"
              />
            </div>

            {/* Brand name — fades in when expanded */}
            <div
              className={cn(
                "leading-none whitespace-nowrap transition-all duration-300",
                isExpanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0 overflow-hidden"
              )}
            >
              <span className="text-[15px] font-bold text-white tracking-tight">Digital</span>
              <span className="text-[15px] font-bold text-[#43eada] tracking-tight">Dent</span>
            </div>
          </Link>
        </div>

        {/* ── Org type badge ── */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            isExpanded ? "mx-3 mt-3 mb-1 max-h-10 opacity-100" : "mx-3 mt-0 mb-0 max-h-0 opacity-0"
          )}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-[#43eada]" />
            {orgType === "lab" ? "Laboratorio" : orgType === "dentist_preview" ? "Vista Previa" : "Clínica Dental"}
          </span>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 space-y-0.5 overflow-hidden px-2 py-3">
          <TooltipProvider delayDuration={300}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const NavIcon = item.icon;
              const isPreviewLocked =
                orgType === "dentist_preview" && !PREVIEW_ALLOWED.includes(item.href);

              if (isPreviewLocked) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <button
                        disabled
                        className={cn(
                          "group relative w-full flex items-center gap-3 rounded-2xl py-2.5 text-[13px] font-medium overflow-hidden opacity-40 cursor-not-allowed",
                          isExpanded ? "px-3" : "justify-center px-2"
                        )}
                      >
                        <NavIcon
                          className={cn(
                            "shrink-0 text-white/40",
                            isExpanded ? "h-[18px] w-[18px]" : "h-5 w-5"
                          )}
                          strokeWidth={1.8}
                        />
                        <span
                          className={cn(
                            "whitespace-nowrap tracking-wide transition-all duration-300 text-white/40",
                            isExpanded ? "opacity-100 max-w-[140px]" : "opacity-0 max-w-0 overflow-hidden"
                          )}
                        >
                          {item.label}
                        </span>
                        {isExpanded && (
                          <Lock className="ml-auto h-3 w-3 shrink-0 text-white/30" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      Disponible en cuenta completa
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  title={!isExpanded ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-2xl py-2.5 text-[13px] font-medium transition-all duration-200 ease-out overflow-hidden",
                    // Active = white pill (inverted) like the reference; inactive = ghost
                    isActive
                      ? "bg-white text-[#033d52] shadow-md"
                      : "text-white/65 hover:bg-white/10 hover:text-white",
                    isExpanded ? "px-3" : "justify-center px-2"
                  )}
                >
                  <NavIcon
                    className={cn(
                      "shrink-0 transition-all duration-200",
                      // Active icon uses dark brand color on white background
                      isActive
                        ? "text-[#044c64]"
                        : "text-white/55 group-hover:text-white",
                      isExpanded ? "h-[18px] w-[18px]" : "h-5 w-5"
                    )}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />

                  {/* Label */}
                  <span
                    className={cn(
                      "whitespace-nowrap tracking-wide transition-all duration-300",
                      isExpanded ? "opacity-100 max-w-[160px]" : "opacity-0 max-w-0 overflow-hidden"
                    )}
                  >
                    {item.label}
                  </span>

                  {/* Active indicator dot */}
                  {isExpanded && isActive && (
                    <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#09919b]" />
                  )}
                </Link>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* ── Footer ── */}
        <div className="shrink-0 space-y-0.5 border-t border-white/10 px-2 pb-3 pt-2">
          {/* Preview mode banner — only visible in dentist_preview when expanded */}
          {orgType === "dentist_preview" && isExpanded && (
            <div className="mx-2 mb-2 rounded-2xl bg-[#43eada]/10 border border-[#43eada]/30 px-3 py-3">
              <p className="text-[11px] font-semibold text-[#43eada] mb-1">Modo vista previa</p>
              <Link
                href="/onboarding?upgrade=true&from=preview"
                className="text-[11px] text-white/70 hover:text-[#43eada] transition-colors"
              >
                Activar cuenta completa →
              </Link>
            </div>
          )}
          {/* Soporte interno */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}
            title={!isExpanded ? "Soporte" : undefined}
            className={cn(
              "group w-full flex items-center gap-3 rounded-2xl py-2.5 text-[13px] font-medium transition-all duration-200 text-white/55 hover:bg-white/10 hover:text-white overflow-hidden",
              isExpanded ? "px-3" : "justify-center px-2"
            )}
          >
            <MessageCircle
              className="shrink-0 h-[18px] w-[18px] text-white/50 group-hover:text-white transition-colors"
              strokeWidth={1.8}
            />
            <span
              className={cn(
                "whitespace-nowrap tracking-wide transition-all duration-300",
                isExpanded ? "opacity-100 max-w-[160px]" : "opacity-0 max-w-0 overflow-hidden"
              )}
            >
              Soporte
            </span>
          </button>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}`}
            target="_blank"
            rel="noopener noreferrer"
            title={!isExpanded ? "WhatsApp" : undefined}
            className={cn(
              "group w-full flex items-center gap-3 rounded-2xl py-2.5 text-[13px] font-medium transition-all duration-200 text-white/55 hover:bg-white/10 hover:text-white overflow-hidden",
              isExpanded ? "px-3" : "justify-center px-2"
            )}
          >
            <Icon
              icon="mdi:whatsapp"
              className="shrink-0 h-[18px] w-[18px] text-white/50 group-hover:text-[#25d366] transition-colors"
            />
            <span
              className={cn(
                "whitespace-nowrap tracking-wide transition-all duration-300",
                isExpanded ? "opacity-100 max-w-[160px]" : "opacity-0 max-w-0 overflow-hidden"
              )}
            >
              WhatsApp
            </span>
          </a>
        </div>
      </aside>
    </>
  );
}
