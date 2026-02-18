import Image from "next/image";
import Link from "next/link";

const footerLinks = {
  producto: [
    { label: "Funciones", href: "#features" },
    { label: "Precios", href: "#pricing" },
    { label: "Integraciones", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  empresa: [
    { label: "Acerca de", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Carreras", href: "#" },
    { label: "Contacto", href: "#" },
  ],
  legal: [
    { label: "Privacidad", href: "#" },
    { label: "Terminos", href: "#" },
    { label: "Cookies", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="DigitalDent" width={32} height={32} className="rounded-lg" />
              <span className="text-lg font-bold">
                <span className="text-[#044c64]">Digital</span><span className="text-[#09919b]">Dent</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              La plataforma lider para conectar clinicas dentales con laboratorios.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">Producto</h3>
            <ul className="space-y-3">
              {footerLinks.producto.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">Empresa</h3>
            <ul className="space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            2026 DigitalDent. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
