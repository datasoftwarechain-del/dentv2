"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { NAV, HERO } from "@/content/landing";

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

        <nav className="hidden items-center gap-7 md:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="premium-transition text-sm text-muted-foreground hover:text-foreground focus-ring rounded-sm">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/login">Iniciar sesión</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={HERO.primary.href}>{HERO.primary.label}</Link>
          </Button>
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
            <nav className="flex flex-col gap-4 p-4" aria-label="Principal">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-ring rounded-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-4">
                <Button asChild className="w-full">
                  <Link href={HERO.primary.href} onClick={() => setMobileMenuOpen(false)}>{HERO.primary.label}</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>Iniciar sesión</Link>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
