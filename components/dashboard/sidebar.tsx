"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Home,
  Users,
  FileText,
  Calendar,
  CreditCard,
  Settings,
  Kanban,
  Package,
  Building2,
  ChevronLeft,
  Menu,
  CalendarClock,
  Scan,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";

interface SidebarProps {
  orgType: "dentist" | "lab";
  orgName: string;
}

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
  { href: "/dashboard/settings", label: "Configuracion", icon: Settings },
];

export function Sidebar({ orgType, orgName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navItems = orgType === "dentist" ? dentistNav : labNav;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLinkClick = useCallback(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  return (
    <>
      {/* Mobile toggle button (Trigger) */}
      <button
        className="fixed right-16 top-3.5 z-50 rounded-lg border border-slate-200 bg-white p-2 transition-all hover:bg-slate-50 shadow-sm lg:hidden"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5 text-slate-700" strokeWidth={1.8} />
      </button>

      {/* Mobile backdrop */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[#044c64] transition-all duration-300 ease-in-out",
          collapsed ? "-translate-x-full lg:translate-x-0 lg:w-20" : "w-64 translate-x-0",
          "lg:relative"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          {!collapsed && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 group"
              onClick={handleLinkClick}
            >
              <Image
                src="/logo.png"
                alt="DigitalDent logo"
                width={36}
                height={36}
                className="rounded-lg shrink-0"
              />
              <div className="leading-none">
                <span className="text-[15px] font-bold text-white tracking-tight">Digital</span>
                <span className="text-[15px] font-bold text-[#43eada] tracking-tight">Dent</span>
              </div>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto">
              <Image
                src="/logo.png"
                alt="DigitalDent logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
            </Link>
          )}
        </div>

        {/* Organization type badge */}
        {!collapsed && (
          <div className="mx-4 mt-4 mb-3 flex">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white border border-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#43eada]" />
              {orgType === "dentist" ? "Clínica Dental" : "Laboratorio"}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "group relative flex items-center gap-3.5 rounded-lg px-3 py-3 text-[13px] font-medium transition-all duration-200 ease-out",
                  isActive
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon
                  className={cn(
                    "shrink-0 transition-all duration-200",
                    isActive ? "text-white" : "text-white/60 group-hover:text-white",
                    collapsed ? "h-5 w-5" : "h-[18px] w-[18px]"
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {!collapsed && <span className="tracking-wide">{item.label}</span>}
                {!collapsed && isActive && (
                  <div className="ml-auto h-1 w-1 rounded-full bg-[#43eada]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer - Simplificado */}
        {!collapsed && (
          <div className="m-4 rounded-lg bg-white/10 p-3 border border-white/15">
            <p className="text-[10px] text-white/70 text-center">
              ¿Necesitas ayuda? Usa el chat flotante
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
