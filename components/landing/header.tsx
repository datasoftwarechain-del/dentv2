"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="glass sticky top-0 z-50 w-full border-b border-border/40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="premium-transition flex items-center gap-2.5 hover:opacity-80">
          <Image src="/logo.png" alt="DigitalDent" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight">
            <span className="text-[#044c64]">Digital</span><span className="text-[#09919b]">Dent</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link href="#features" className="premium-transition text-sm text-muted-foreground hover:text-foreground">
            Funciones
          </Link>
          <Link href="#how-it-works" className="premium-transition text-sm text-muted-foreground hover:text-foreground">
            Como Funciona
          </Link>
          <Link href="#pricing" className="premium-transition text-sm text-muted-foreground hover:text-foreground">
            Precios
          </Link>
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">
              Iniciar Sesion
            </Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button size="sm">Registrarse</Button>
          </Link>
        </div>

        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border md:hidden">
          <nav className="flex flex-col gap-4 p-4">
            <Link
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Funciones
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Como Funciona
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Precios
            </Link>
            <div className="flex flex-col gap-2 pt-4">
              <Link href="/auth/login">
                <Button variant="outline" className="w-full">
                  Iniciar Sesion
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button className="w-full">Registrarse</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
