import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden">
      {/* Same gradient background as auth pages */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-accent to-primary opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.187rem]" />
      </div>

      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-8xl font-black text-premium-gradient">404</h1>
          <h2 className="text-2xl font-bold text-foreground">Página no encontrada</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            La página que buscás no existe o fue movida.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/dashboard">Ir al Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
