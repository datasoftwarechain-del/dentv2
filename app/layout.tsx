import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "DigitalDent",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Plataforma SaaS que conecta clínicas dentales con laboratorios para una gestión eficiente de turnos, historia clínica, pedidos y facturación.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "author": { "@type": "Organization", "name": "DigitalDent" },
};

export const metadata: Metadata = {
  metadataBase: new URL("https://digitaldent.app"),
  title: {
    default: "DigitalDent — Gestión Dental Inteligente",
    template: "%s | DigitalDent",
  },
  description: "Plataforma SaaS que conecta clínicas dentales con laboratorios. Gestiona turnos, historia clínica, pedidos digitales y facturación en un solo lugar.",
  keywords: ["gestión dental", "laboratorio dental", "agenda dental", "historia clínica", "software dental", "odontología digital"],
  authors: [{ name: "DigitalDent" }],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://digitaldent.app",
    title: "DigitalDent — Gestión Dental Inteligente",
    description: "Conectamos clínicas dentales con laboratorios. Gestión de turnos, órdenes, historia clínica y facturación en una sola plataforma.",
    siteName: "DigitalDent",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "DigitalDent — Gestión Dental Inteligente" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DigitalDent — Gestión Dental Inteligente",
    description: "Conectamos clínicas dentales con laboratorios.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://digitaldent.app" },
};

export const viewport = {
  themeColor: "#044c64",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
