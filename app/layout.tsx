import type { ReactNode } from "react";

export const metadata = {
  title: "dentv2",
  description: "Next.js app scaffolded for v0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
