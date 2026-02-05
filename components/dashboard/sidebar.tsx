"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  CreditCard,
  Settings,
  Kanban,
  Building2,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";

interface SidebarProps {
  orgType: "dentist" | "lab";
  orgName: string;
}

const dentistNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/patients", label: "Pacientes", icon: Users },
  { href: "/dashboard/appointments", label: "Citas", icon: Calendar },
  { href: "/dashboard/orders", label: "Pedidos", icon: FileText },
  { href: "/dashboard/billing", label: "Facturacion", icon: CreditCard },
  { href: "/dashboard/settings", label: "Configuracion", icon: Settings },
];

const labNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Pedidos", icon: FileText },
  { href: "/dashboard/kanban", label: "Produccion", icon: Kanban },
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
        className="fixed right-16 top-3.5 z-50 rounded-lg border border-border bg-background p-2 transition-all hover:bg-muted lg:hidden"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/50 bg-background/80 backdrop-blur-xl transition-all duration-300 ease-in-out",
          collapsed ? "-translate-x-full lg:translate-x-0 lg:w-20" : "w-64 translate-x-0",
          "lg:relative"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 group"
              onClick={handleLinkClick}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg group-hover:scale-110 transition-transform">
                <span className="text-sm font-bold text-white">DL</span>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                DentLab
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg hover:scale-110 transition-transform">
              <span className="text-sm font-bold text-white">DL</span>
            </Link>
          )}
        </div>

        {/* Organization */}
        {!collapsed && (
          <div className="mx-4 my-4 rounded-xl bg-muted/50 p-3 ring-1 ring-border/50">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
              {orgType === "dentist" ? "👨‍⚕️ Clínica" : "🔬 Lab"}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{orgName}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground/50" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="m-4 rounded-2xl bg-gradient-to-br from-accent/10 to-transparent p-4 border border-accent/20">
            <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Soporte Pro
            </p>
            <p className="text-[11px] text-muted-foreground mb-3">
              ¿Tienes alguna duda técnica? Estamos para ayudarte.
            </p>
            <Button variant="outline" size="sm" className="w-full text-xs h-8 bg-background/50 hover:bg-accent hover:text-white transition-colors">
              Chat de ayuda
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
