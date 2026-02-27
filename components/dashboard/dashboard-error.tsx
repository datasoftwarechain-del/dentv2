"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold text-foreground">Algo salió mal</h2>
        <p className="text-muted-foreground">
          Ocurrió un error inesperado. Intentá de nuevo o contactá soporte si el problema persiste.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            Código: {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Intentar de nuevo
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
