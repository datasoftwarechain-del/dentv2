"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    orgName: "",
    orgType: "",
    phone: "",
    address: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      setUserId(user.id);

      // Pre-fill from user metadata if available
      const meta = user.user_metadata;
      if (meta?.org_name || meta?.org_type) {
        setFormData((prev) => ({
          ...prev,
          orgName: meta.org_name || "",
          orgType: meta.org_type || "",
        }));
      }
    }
    checkUser();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setError(null);
    setLoading(true);

    const supabase = createClient();

    // Create organization
    const { error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: formData.orgName,
        type: formData.orgType,
        phone: formData.phone || null,
        address: formData.address || null,
      });

    if (orgError) {
      setError(orgError.message);
      setLoading(false);
      return;
    }

    // The trigger 'on_org_created' in database handles adding the user as owner
    // scripts/002_fix_permissions.sql

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">DL</span>
          </div>
          <CardTitle>Configura tu organizacion</CardTitle>
          <CardDescription>
            Completa los datos de tu clinica o laboratorio para comenzar
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
              <Label htmlFor="orgName">Nombre de la organizacion</Label>
              <Input
                id="orgName"
                placeholder="Clinica Dental Sonrisa"
                value={formData.orgName}
                onChange={(e) =>
                  setFormData({ ...formData, orgName: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgType">Tipo de organizacion</Label>
              <select
                id="orgType"
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 focus:bg-background"
                value={formData.orgType}
                onChange={(e) =>
                  setFormData({ ...formData, orgType: e.target.value })
                }
                required
              >
                <option value="" disabled>
                  Selecciona el tipo
                </option>
                <option value="dentist">Clinica Dental</option>
                <option value="lab">Laboratorio Dental</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefono (opcional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Direccion (opcional)</Label>
              <Input
                id="address"
                placeholder="Calle Principal 123, Ciudad"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Organizacion
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
