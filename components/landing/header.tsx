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
    // Chrome flotante: capa translúcida con el contenido pasando por debajo,
    // no una franja opaca que se come 64 px de pantalla.
    //
    // El header cruza secciones claras Y oscuras (la franja del coverflow de
    // Servicios). Medido: `text-muted-foreground` NO llega a AA en ningún
    // escenario — 4,33:1 incluso sobre la página clara, contra el mínimo de
    // 4,5 — así que el problema nunca fue la opacidad del fondo sino el color
    // del texto. Con `foreground/80` el contraste es 5,89:1 sobre la franja
    // oscura y 8,91:1 sobre la clara, con la barra al 70 %: material real y
    // además más legible que la versión casi opaca que reemplaza.
    //
    // En vez de un borde de 1 px constante, el borde inferior se desvanece
    // (`mask-image`): es el scroll edge effect, visible solo donde hay
    // contenido debajo del chrome.
    <header className="sticky top-0 z-50 w-full bg-background/70 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-background/95 [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-filter-none after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-px after:bg-border/70 after:[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="premium-transition flex items-center gap-2.5 hover:opacity-80 focus-ring rounded-md">
          <Image src="/logo.png" alt="DigitalDent" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-[-.005em]" aria-hidden="true">
            <span className="text-primary">Digital</span><span className="text-secondary">Dent</span>
          </span>
          <span className="sr-only">DigitalDent — inicio</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="premium-transition rounded-sm text-sm font-medium tracking-[.005em] text-foreground/80 hover:text-foreground focus-ring">
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
            // Spring, no tween: el menú es algo que el usuario toca, y una
            // duración fija no puede responder si vuelve a tocar el botón
            // mientras se está abriendo. Sin rebote (bounce 0): no hubo
            // gesto con momento, solo un toque.
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            // Material MÁS PESADO que la barra: el panel tapa contenido
            // cualquiera y a 70 % el texto competía con lo que pasara detrás.
            // La jerarquía se codifica en el peso del material.
            className="border-t border-border bg-background/95 backdrop-blur-xl md:hidden [@media(prefers-reduced-transparency:reduce)]:bg-background"
          >
            <nav className="flex flex-col gap-4 p-4" aria-label="Principal">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-sm text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-ring"
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
