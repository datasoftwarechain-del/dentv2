import Image from "next/image";
import Link from "next/link";
import { FOOTER } from "@/content/landing";

/**
 * Solo enlaces que llevan a algún lado. Términos, Privacidad y Contacto
 * vuelven cuando existan las páginas y el canal: un link a "#" resta
 * más confianza que no tenerlo.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="DigitalDent" width={32} height={32} className="rounded-lg" />
              <span className="text-lg font-bold">
                <span className="text-primary">Digital</span><span className="text-secondary">Dent</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">{FOOTER.tagline}</p>
          </div>

          {FOOTER.groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-sm font-semibold">{group.title}</h3>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            {new Date().getFullYear()} DigitalDent · Montevideo, Uruguay.
          </p>
        </div>
      </div>
    </footer>
  );
}
