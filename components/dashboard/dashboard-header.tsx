"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, LogOut, Settings, User } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export function DashboardHeader({ title, user }: DashboardHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.email[0].toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between px-6 bg-background/60 backdrop-blur-xl border-b border-border/40">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight text-premium-gradient">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 mr-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted/80 transition-colors">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent border-2 border-background" />
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative flex items-center gap-2 px-1 py-1 h-10 rounded-full hover:bg-muted/80 transition-all border border-transparent hover:border-border/50">
              <Avatar className="h-8 w-8 transition-transform group-hover:scale-105 shadow-sm">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col items-start pr-2">
                <span className="text-xs font-semibold leading-none">{user.firstName || "Usuario"}</span>
                <span className="text-[10px] text-muted-foreground leading-none mt-1">{user.email.split('@')[0]}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-2 rounded-2xl shadow-2xl border-border/50 bg-popover/95 backdrop-blur-xl">
            <DropdownMenuLabel className="px-3 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-primary/10">
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-bold leading-none">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate max-w-[140px]">{user.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-1" />
            <div className="space-y-1 my-1">
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="rounded-xl px-3 py-2 cursor-pointer focus:bg-primary/5">
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Mi Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="rounded-xl px-3 py-2 cursor-pointer focus:bg-primary/5">
                <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Configuración</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="mx-1" />
            <DropdownMenuItem onClick={handleLogout} className="rounded-xl px-3 py-2 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
