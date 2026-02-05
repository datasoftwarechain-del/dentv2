import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "DentLab Pro - Gestión de Laboratorio Dental",
  description: "Plataforma SaaS que conecta clínicas dentales con laboratorios para una gestión eficiente de pedidos, producción y facturación.",
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
