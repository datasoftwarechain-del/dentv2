"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden">
      {/* Background gradient — identical to login */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-accent to-primary opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.187rem]" />
      </div>

      <Card className="glass-card w-full max-w-md border-none">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-4 flex items-center gap-2.5">
            <img src="/logo.png" alt="DigitalDent" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-bold">
              <span className="text-[#044c64]">Digital</span>
              <span className="text-[#09919b]">Dent</span>
            </span>
          </Link>
          <CardTitle>Recuperar Contraseña</CardTitle>
          <CardDescription>
            Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                  <CheckCircle className="h-9 w-9 text-accent" />
                </div>
              </div>
              <p className="font-semibold text-foreground">Email enviado</p>
              <p className="text-sm text-muted-foreground">
                Revisá tu bandeja de entrada y seguí el enlace para restablecer tu contraseña.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio de sesión
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar enlace de recuperación
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1 text-foreground hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Volver al login
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
