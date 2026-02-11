"use client";

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
  { href: "/dashboard/orders", label: "Pedidos", icon: FileText },
  { href: "/dashboard/schedule", label: "Agenda Semanal", icon: CalendarClock },
  { href: "/dashboard/billing", label: "Facturacion", icon: CreditCard },
  { href: "/dashboard/settings", label: "Configuracion", icon: Settings },
];

const labNav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/orders", label: "Pedidos", icon: FileText },
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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out",
          collapsed ? "-translate-x-full lg:translate-x-0 lg:w-20" : "w-64 translate-x-0",
          "lg:relative"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
          {!collapsed && (
            <Link
              href="/dashboard"
              className="flex items-center gap-3 group"
              onClick={handleLinkClick}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 shadow-sm group-hover:bg-slate-800 transition-colors">
                <span className="text-[13px] font-bold text-white tracking-tight">DL</span>
              </div>
              <span className="text-[17px] font-bold text-slate-900 tracking-tight">
                DentLab
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 shadow-sm hover:bg-slate-800 transition-colors">
              <span className="text-[13px] font-bold text-white tracking-tight">DL</span>
            </Link>
          )}
        </div>

        {/* Organization */}
        {!collapsed && (
          <div className="mx-4 mt-4 mb-3 rounded-lg bg-slate-50 px-3 py-2.5 border border-slate-200/60">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
              {orgType === "dentist" ? "Clínica" : "Laboratorio"}
            </p>
            <p className="truncate text-[13px] font-semibold text-slate-900">{orgName}</p>
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
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon
                  className={cn(
                    "shrink-0 transition-all duration-200",
                    isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700",
                    collapsed ? "h-5 w-5" : "h-[18px] w-[18px]"
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {!collapsed && <span className="tracking-wide">{item.label}</span>}
                {!collapsed && isActive && (
                  <div className="ml-auto h-1 w-1 rounded-full bg-white/70" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="m-4 rounded-lg bg-slate-50 p-4 border border-slate-200/80">
            <p className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Soporte disponible
            </p>
            <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
              ¿Necesitas ayuda? Estamos aquí para ti.
            </p>
            <Button variant="outline" size="sm" className="w-full text-[11px] h-8 bg-white hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all border-slate-300">
              Contactar soporte
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
