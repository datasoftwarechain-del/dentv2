"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-warm the dashboard route so it's compiled and ready when the user logs in
  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Hard redirect: ensures the new Supabase session cookie is sent with the
    // first server request to /dashboard. SPA navigation (router.replace) can race
    // with cookie propagation and cause a hang on the first login attempt.
    window.location.replace("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-accent to-primary opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.187rem]" />
      </div>

      <Card className="glass-card w-full max-w-md border-none">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-4 flex items-center gap-2.5">
            <img src="/logo.png" alt="DigitalDent" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-bold">
              <span className="text-[#044c64]">Digital</span><span className="text-[#09919b]">Dent</span>
            </span>
          </Link>
          <CardTitle>Iniciar Sesion</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder a tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo electronico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contrasena</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Olvidaste tu contrasena?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesion
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              No tienes cuenta?{" "}
              <Link href="/auth/sign-up" className="text-foreground hover:underline">
                Registrate
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
