"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Building2, Shield, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { PriceCatalogSection } from "@/components/settings/price-catalog";
import { CollaboratorsSection } from "@/components/settings/collaborators-section";

interface SettingsFormProps {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  organization: {
    id: string;
    name: string;
    type: string;
    phone: string | null;
    address: string | null;
  };
  role: string;
}

export function SettingsForm({ user, organization, role }: SettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profileData, setProfileData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
  });

  const [orgData, setOrgData] = useState({
    name: organization.name,
    phone: organization.phone || "",
    address: organization.address || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [labSearch, setLabSearch] = useState("");
  const [labSearchLoading, setLabSearchLoading] = useState(false);
  const [labSearchResults, setLabSearchResults] = useState<
    { id: string; name: string }[]
  >([]);
  const [connectedLabs, setConnectedLabs] = useState<
    { id: string; name: string; status: string }[]
  >([]);
  const [labsLoading, setLabsLoading] = useState(false);

  useEffect(() => {
    if (organization.type !== "dentist") return;
    let isMounted = true;

    async function loadConnectedLabs() {
      setLabsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lab_dentist_relations")
        .select(
          "status, lab_org:organizations!lab_dentist_relations_lab_org_id_fkey(id, name)"
        )
        .eq("dentist_org_id", organization.id)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        setError(error.message);
      } else {
        type LabOrg = { id: string; name: string };
        type LabRelation = { lab_org: LabOrg | LabOrg[] | null; status?: string | null };
        const relations = (data || []) as LabRelation[];
        const labs = relations
          .flatMap((rel) => {
            const lab = rel.lab_org;
            if (!lab) return [];
            const labList = Array.isArray(lab) ? lab : [lab];
            return labList.map((entry) => ({
              id: entry.id,
              name: entry.name,
              status: rel.status || "active",
            }));
          })
          .filter((lab): lab is { id: string; name: string; status: string } =>
            Boolean(lab?.id && lab?.name)
          );
        setConnectedLabs(labs);
      }
      setLabsLoading(false);
    }

    loadConnectedLabs();

    return () => {
      isMounted = false;
    };
  }, [organization.id, organization.type]);

  async function handleLabSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const query = labSearch.trim();
    if (!query) {
      setLabSearchResults([]);
      return;
    }

    setLabSearchLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("search_labs", {
      search_term: query,
    });

    if (error) {
      setError(error.message);
      setLabSearchResults([]);
    } else {
      setLabSearchResults((data || []) as { id: string; name: string }[]);
    }
    setLabSearchLoading(false);
  }

  async function handleConnectLab(labId: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("lab_dentist_relations")
      .insert({
        lab_org_id: labId,
        dentist_org_id: organization.id,
        status: "active",
      });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Laboratorio conectado correctamente");
      setLabSearch("");
      setLabSearchResults([]);
      const { data } = await supabase
        .from("lab_dentist_relations")
        .select(
          "status, lab_org:organizations!lab_dentist_relations_lab_org_id_fkey(id, name)"
        )
        .eq("dentist_org_id", organization.id)
        .order("created_at", { ascending: false });
      type LabOrg = { id: string; name: string };
      type LabRelation = { lab_org: LabOrg | LabOrg[] | null; status?: string | null };
      const relations = (data || []) as LabRelation[];
      const labs = relations
        .flatMap((rel) => {
          const lab = rel.lab_org;
          if (!lab) return [];
          const labList = Array.isArray(lab) ? lab : [lab];
          return labList.map((entry) => ({
            id: entry.id,
            name: entry.name,
            status: rel.status || "active",
          }));
        })
        .filter((lab): lab is { id: string; name: string; status: string } =>
          Boolean(lab?.id && lab?.name)
        );
      setConnectedLabs(labs);
      router.refresh();
    }

    setLoading(false);
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Perfil actualizado correctamente");
      toast.success("Perfil actualizado correctamente");
      router.refresh();
    }

    setLoading(false);
  }

  async function handleOrgUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("organizations")
      .update({
        name: orgData.name,
        phone: orgData.phone || null,
        address: orgData.address || null,
      })
      .eq("id", organization.id);

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Organizacion actualizada correctamente");
      toast.success("Organización actualizada correctamente");
      router.refresh();
    }

    setLoading(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("Las contrasenas no coinciden");
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Contrasena actualizada correctamente");
      toast.success("Contraseña actualizada correctamente");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }

    setLoading(false);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {success && (
        <Alert className="border-secondary/25 bg-secondary/[0.08] text-secondary">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Perfil Personal</CardTitle>
          </div>
          <CardDescription>Actualiza tu informacion personal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  value={profileData.firstName}
                  onChange={(e) =>
                    setProfileData({ ...profileData, firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  value={profileData.lastName}
                  onChange={(e) =>
                    setProfileData({ ...profileData, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electronico</Label>
              <Input id="email" value={user.email} disabled />
              <p className="text-xs text-muted-foreground">
                El correo no puede ser modificado
              </p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      {role === "admin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Organizacion</CardTitle>
            </div>
            <CardDescription>
              Configura los datos de tu {organization.type === "dentist" ? "clinica" : "laboratorio"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOrgUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Nombre</Label>
                <Input
                  id="orgName"
                  value={orgData.name}
                  onChange={(e) =>
                    setOrgData({ ...orgData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgPhone">Telefono</Label>
                <Input
                  id="orgPhone"
                  type="tel"
                  value={orgData.phone}
                  onChange={(e) =>
                    setOrgData({ ...orgData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgAddress">Direccion</Label>
                <Input
                  id="orgAddress"
                  value={orgData.address}
                  onChange={(e) =>
                    setOrgData({ ...orgData, address: e.target.value })
                  }
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Actualizar Organizacion
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Arancel / Servicios — solo admins */}
      {role === "admin" && (
        <PriceCatalogSection
          orgId={organization.id}
          orgType={organization.type}
        />
      )}

      {/* Colaboradores — solo admins */}
      {role === "admin" && (
        <CollaboratorsSection
          orgId={organization.id}
          orgType={organization.type as "dentist" | "lab"}
        />
      )}

      {/* Lab Connections */}
      {role === "admin" && organization.type === "dentist" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              <CardTitle>Laboratorios</CardTitle>
            </div>
            <CardDescription>
              Busca y conecta laboratorios para enviar pedidos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleLabSearch} className="flex items-center gap-2">
              <Input
                value={labSearch}
                onChange={(e) => setLabSearch(e.target.value)}
                placeholder="Buscar laboratorio por nombre"
              />
              <Button type="submit" disabled={labSearchLoading}>
                {labSearchLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Buscar
              </Button>
            </form>

            {labSearchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Resultados
                </p>
                <div className="space-y-2">
                  {labSearchResults.map((lab) => {
                    const alreadyConnected = connectedLabs.some(
                      (connected) => connected.id === lab.id
                    );
                    return (
                      <div
                        key={lab.id}
                        className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
                      >
                        <div className="text-sm font-medium">{lab.name}</div>
                        <Button
                          type="button"
                          variant={alreadyConnected ? "outline" : "default"}
                          disabled={alreadyConnected || loading}
                          onClick={() => handleConnectLab(lab.id)}
                        >
                          {alreadyConnected ? "Conectado" : "Conectar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Laboratorios conectados
              </p>
              {labsLoading ? (
                <div className="text-sm text-muted-foreground">Cargando...</div>
              ) : connectedLabs.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Aún no tienes laboratorios conectados
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedLabs.map((lab) => (
                    <div
                      key={lab.id}
                      className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{lab.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Estado: {lab.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Seguridad</CardTitle>
          </div>
          <CardDescription>Actualiza tu contrasena</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva Contrasena</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contrasena</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value,
                  })
                }
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cambiar Contrasena
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Danger Zone */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-muted-foreground">Eliminar cuenta</CardTitle>
          <CardDescription>
            Para eliminar tu cuenta contacta a soporte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}
          >
            Contactar soporte
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
