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
  "description": "Plataforma de odontología digital: diseño CAD online, fresado e impresión 3D en Uruguay y software de gestión para clínicas y laboratorios.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "author": { "@type": "Organization", "name": "DigitalDent" },
};

export const metadata: Metadata = {
  metadataBase: new URL("https://digitaldent.app"),
  title: {
    default: "DigitalDent — Plataforma de odontología digital",
    template: "%s | DigitalDent",
  },
  description: "Diseño CAD online desde US$ 6, fresado e impresión 3D en Uruguay y software para clínicas y laboratorios. Del escaneo a la pieza terminada.",
  keywords: ["odontología digital", "diseño dental CAD", "diseño STL corona", "laboratorio dental Uruguay", "fresado zirconio Montevideo", "impresión 3D dental", "software dental"],
  authors: [{ name: "DigitalDent" }],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://digitaldent.app",
    title: "DigitalDent — Plataforma de odontología digital",
    description: "Diseño CAD online, fresado e impresión 3D en Uruguay y software para clínicas y laboratorios.",
    siteName: "DigitalDent",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "DigitalDent — Plataforma de odontología digital" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DigitalDent — Plataforma de odontología digital",
    description: "Diseño CAD online, fresado e impresión en Uruguay y software dental.",
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
