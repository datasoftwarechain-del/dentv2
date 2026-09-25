"use client";

/**
 * Card de servicio, paleta clara.
 *
 * Adaptada del export de Claude Design (variante A) a la paleta clara de
 * la variante B, por decisión de producto: la landing es clara y una
 * sección oscura de 1.900px la partía en dos.
 *
 * Tres estados con señal visual creciente — default, hover (elevación +
 * borde + zoom de imagen) y activa (borde teal + halo) — porque en el
 * coverflow la card activa es la única con la que se puede interactuar y
 * tiene que verse como tal sin depender del movimiento.
 *
 * El botón es un <Link> real: navegable por teclado, abre en la misma
 * pestaña y funciona sin JavaScript.
 */

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScopeChip } from "./scope-chip";
import type { ServiceCardContent } from "@/content/servicios";
import { ArrowUpRight, Clock, Layers } from "lucide-react";

interface ServiceCardProps {
  item: ServiceCardContent;
  size?: "hero" | "compact";
  active?: boolean;
  /** Texto de precio ya formateado, o null para no mostrar. */
  price?: string | null;
  /** En el coverflow las laterales no son interactivas: sin tabIndex ni CTA. */
  inert?: boolean;
  className?: string;
}

export function ServiceCard({
  item, size = "hero", active = false, price = null, inert = false, className,
}: ServiceCardProps) {
  const hero = size === "hero";
  const ww = item.scope === "worldwide";

  return (
    <article
      aria-label={item.title}
      className={cn(
        "group flex h-full w-full flex-col rounded-[28px] bg-white p-2.5",
        "border transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none",
        active
          ? "border-[var(--dd-deep-600)] shadow-[0_0_0_3px_rgba(32,80,104,.14),0_18px_44px_rgba(18,45,60,.16)]"
          : "border-[rgba(32,80,104,.08)] shadow-[0_6px_18px_rgba(18,45,60,.08)] hover:-translate-y-1 hover:border-[rgba(32,80,104,.28)] hover:shadow-[0_18px_44px_rgba(18,45,60,.16)]",
        className,
      )}
    >
      {/* ─── Media ─────────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex-none overflow-hidden rounded-[20px]",
          hero ? "h-[220px]" : "h-[150px]",
          item.image ? "bg-[#dbf4f7]" : ww ? "bg-[var(--dd-mist-100)]" : "bg-[#edf4fb]",
        )}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 340px, 331px"
            loading="lazy"
            className={cn(
              "object-contain transition-transform duration-[360ms] ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none",
              hero ? "p-[34px_22px_18px]" : "p-[30px_18px_12px]",
              active ? "scale-[1.07]" : "group-hover:scale-[1.07]",
            )}
          />
        ) : (
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 flex items-center justify-center pt-5 text-center",
              "bg-[repeating-linear-gradient(135deg,rgba(32,80,104,.05)_0_8px,transparent_8px_16px)]",
              "transition-transform duration-[360ms] motion-reduce:transition-none",
              active ? "scale-[1.07]" : "group-hover:scale-[1.07]",
            )}
          >
            <span className="px-4 font-mono text-[10.5px] uppercase leading-[1.3] tracking-[.04em] text-[var(--dd-deep-400)]">
              {item.placeholder}
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3">
          <ScopeChip scope={item.scope} size="sm" />
        </div>

        {hero && !inert && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-2.5 top-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full transition-colors duration-200",
              active
                ? "bg-[var(--dd-deep-600)] text-white"
                : "bg-white text-[var(--dd-deep-600)] group-hover:bg-[var(--dd-deep-600)] group-hover:text-white",
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
        )}
      </div>

      {/* ─── Cuerpo ────────────────────────────────────────── */}
      <div className={cn("flex flex-1 flex-col justify-between", hero ? "gap-4 px-2.5 pb-2 pt-[18px]" : "gap-3.5 px-2 pb-1.5 pt-3.5")}>
        <div className="flex flex-col gap-1.5">
          <h3 className={cn("m-0 font-semibold leading-[1.2] tracking-[-.01em] text-[var(--dd-deep-800)] [text-wrap:pretty]", hero ? "text-[22px]" : "text-[17px]")}>
            {item.title}
          </h3>
          <p className={cn("m-0 leading-[1.5] text-[var(--dd-neutral-700)] [text-wrap:pretty]", hero ? "text-[14.5px]" : "text-[13.5px]")}>
            {item.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Chip><Clock className="h-[13px] w-[13px]" aria-hidden="true" />{item.time}</Chip>
          <Chip><Layers className="h-[13px] w-[13px]" aria-hidden="true" />{item.spec}</Chip>
          {price && (
            <span className="ml-auto text-[13px] font-semibold tabular-nums text-[var(--dd-deep-800)]">
              {price}
            </span>
          )}
        </div>

        {!inert && (
          <Link
            href={item.href}
            className={cn(
              "focus-ring inline-flex w-full items-center justify-center rounded-full font-medium transition-colors duration-200",
              hero ? "h-10 text-[14px]" : "h-9 text-[13px]",
              active
                ? "bg-[var(--dd-deep-600)] text-white hover:bg-[var(--dd-deep-700)]"
                : "border border-[rgba(32,80,104,.16)] bg-white text-[var(--dd-deep-600)] hover:bg-[var(--dd-mist-050)]",
            )}
          >
            {item.cta}
          </Link>
        )}
      </div>
    </article>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[rgba(32,80,104,.1)] bg-[var(--dd-mist-050)] px-2.5 text-[12px] font-medium tabular-nums leading-none text-[var(--dd-deep-700)]">
      {children}
    </span>
  );
}
