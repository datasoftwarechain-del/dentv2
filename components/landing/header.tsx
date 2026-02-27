"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="glass sticky top-0 z-50 w-full border-b border-border/40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="premium-transition flex items-center gap-2.5 hover:opacity-80 focus-ring rounded-md">
          <Image src="/logo.png" alt="DigitalDent" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight" aria-hidden="true">
            <span className="text-primary">Digital</span><span className="text-secondary">Dent</span>
          </span>
          <span className="sr-only">DigitalDent — inicio</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link href="#features" className="premium-transition text-sm text-muted-foreground hover:text-foreground focus-ring rounded-sm">
            Funciones
          </Link>
          <Link href="#how-it-works" className="premium-transition text-sm text-muted-foreground hover:text-foreground focus-ring rounded-sm">
            Cómo Funciona
          </Link>
          <Link href="#pricing" className="premium-transition text-sm text-muted-foreground hover:text-foreground focus-ring rounded-sm">
            Precios
          </Link>
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">
              Iniciar Sesión
            </Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button size="sm">Registrarse</Button>
          </Link>
        </div>

        <button
          className="focus-ring rounded-md p-1 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileMenuOpen}
        >
          <AnimatePresence mode="wait" initial={false}>
            {mobileMenuOpen ? (
              <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="h-6 w-6" />
              </motion.span>
            ) : (
              <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Menu className="h-6 w-6" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="border-t border-border md:hidden"
          >
            <nav className="flex flex-col gap-4 p-4">
              <Link
                href="#features"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-ring rounded-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                Funciones
              </Link>
              <Link
                href="#how-it-works"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-ring rounded-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                Cómo Funciona
              </Link>
              <Link
                href="#pricing"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-ring rounded-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                Precios
              </Link>
              <div className="flex flex-col gap-2 pt-4">
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">
                    Iniciar Sesión
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button className="w-full">Registrarse</Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
