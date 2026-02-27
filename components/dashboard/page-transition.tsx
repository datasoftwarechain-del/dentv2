"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps dashboard page content with a subtle fade + micro-lift entrance animation.
 *
 * How it works:
 * - usePathname() is read so the component re-renders on every navigation.
 * - The inner <div> uses that pathname as its React `key`.
 * - When the key changes, React unmounts/remounts the div → the CSS animation
 *   restarts from scratch, giving a fresh entrance on every page transition.
 * - No Framer Motion, no heavy deps — pure CSS via the Tailwind `animate-page-in` token.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
