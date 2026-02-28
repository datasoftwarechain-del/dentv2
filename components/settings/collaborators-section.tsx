"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  UserPlus,
  Loader2,
  Trash2,
  Pencil,
  Users,
  ShieldAlert,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  type CollaboratorPermissions,
  type PermissionKey,
  PERMISSION_LABELS,
  PERMISSION_GROUPS,
  PERMISSION_PRESETS,
  DENTIST_PERMISSIONS,
  LAB_PERMISSIONS,
  EMPTY_PERMISSIONS,
  normalizePermissions,
} from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Collaborator {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  permissions: CollaboratorPermissions;
  status: "active" | "suspended";
  created_at: string;
}

interface CollaboratorsSectionProps {
  orgId: string;
  orgType: "dentist" | "lab";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function getApplicableKeys(orgType: "dentist" | "lab"): PermissionKey[] {
  return orgType === "dentist" ? DENTIST_PERMISSIONS : LAB_PERMISSIONS;
}

// ─── Permission Toggles Component ─────────────────────────────────────────────

function PermissionToggles({
  permissions,
  onChange,
  orgType,
}: {
  permissions: CollaboratorPermissions;
  onChange: (updated: CollaboratorPermissions) => void;
  orgType: "dentist" | "lab";
}) {
  const applicable = new Set(getApplicableKeys(orgType));

  const toggle = (key: PermissionKey) => {
    onChange({ ...permissions, [key]: !permissions[key] });
  };

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => {
        const visibleKeys = group.keys.filter((k) => applicable.has(k));
        if (visibleKeys.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <p className="mb-2 text-xs text-muted-foreground">{group.description}</p>
            <div className="space-y-2">
              {visibleKeys.map((key) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                  <Label
                    htmlFor={`perm-${key}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {PERMISSION_LABELS[key]}
                  </Label>
                  <Switch
                    id={`perm-${key}`}
                    checked={!!permissions[key]}
                    onCheckedChange={() => toggle(key)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Invite Dialog ─────────────────────────────────────────────────────────────

function InviteDialog({
  open,
  onOpenChange,
  orgId,
  orgType,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  orgType: "dentist" | "lab";
  onSuccess: (collaborator: Collaborator) => void;
}) {
  const [step, setStep] = useState<"info" | "permissions">("info");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("receptionist");

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [permissions, setPermissions] = useState<CollaboratorPermissions>({
    ...EMPTY_PERMISSIONS,
  });

  // Apply preset when it changes
  useEffect(() => {
    const preset = PERMISSION_PRESETS.find((p) => p.id === selectedPreset);
    if (preset && selectedPreset !== "custom") {
      setPermissions({ ...preset.permissions });
    }
  }, [selectedPreset]);

  function reset() {
    setStep("info");
    setForm({ displayName: "", email: "", password: "" });
    setPermissions({ ...EMPTY_PERMISSIONS });
    setSelectedPreset("receptionist");
    setShowPassword(false);
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/collaborators", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({
          orgId,
          displayName: form.displayName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          permissions,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Error al crear colaborador");
        return;
      }

      toast.success("Colaborador creado correctamente");
      onSuccess(json.data as Collaborator);
      onOpenChange(false);
      reset();
    } catch {
      toast.error("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const infoValid =
    form.displayName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.password.length >= 8;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {step === "info" ? "Datos del colaborador" : "Permisos de acceso"}
          </DialogTitle>
          <DialogDescription>
            {step === "info"
              ? "Ingresa los datos de acceso que le darás al colaborador."
              : "Selecciona un perfil o configura los permisos individualmente."}
          </DialogDescription>
        </DialogHeader>

        {step === "info" ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="collab-name">Nombre completo</Label>
              <Input
                id="collab-name"
                placeholder="Ej: María González"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collab-email">Correo electrónico</Label>
              <Input
                id="collab-email"
                type="email"
                placeholder="colaborador@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collab-password">Contraseña temporal</Label>
              <div className="relative">
                <Input
                  id="collab-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Comparte estas credenciales con el colaborador. Podrán cambiar su contraseña en Configuración.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Preset selector */}
            <div className="space-y-2">
              <Label>Perfil de acceso</Label>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selectedPreset === preset.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Individual toggles */}
            <PermissionToggles
              permissions={permissions}
              onChange={(updated) => {
                setPermissions(updated);
                setSelectedPreset("custom");
              }}
              orgType={orgType}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "permissions" && (
            <Button variant="outline" onClick={() => setStep("info")} disabled={loading}>
              Atrás
            </Button>
          )}
          {step === "info" ? (
            <Button onClick={() => setStep("permissions")} disabled={!infoValid}>
              Siguiente: Permisos
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear colaborador
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Permissions Dialog ───────────────────────────────────────────────────

function EditDialog({
  collaborator,
  orgId,
  orgType,
  onClose,
  onSuccess,
}: {
  collaborator: Collaborator;
  orgId: string;
  orgType: "dentist" | "lab";
  onClose: () => void;
  onSuccess: (updated: Collaborator) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(collaborator.display_name ?? "");
  const [permissions, setPermissions] = useState<CollaboratorPermissions>(
    normalizePermissions(collaborator.permissions)
  );

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/collaborators/${collaborator.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({ orgId, displayName: displayName.trim(), permissions }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al actualizar");
        return;
      }

      toast.success("Permisos actualizados correctamente");
      onSuccess({ ...collaborator, permissions, display_name: displayName.trim() });
      onClose();
    } catch {
      toast.error("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus() {
    const newStatus = collaborator.status === "active" ? "suspended" : "active";
    setLoading(true);
    try {
      const res = await fetch(`/api/collaborators/${collaborator.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({ orgId, status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al cambiar estado");
        return;
      }

      toast.success(newStatus === "active" ? "Colaborador reactivado" : "Colaborador suspendido");
      onSuccess({ ...collaborator, status: newStatus });
      onClose();
    } catch {
      toast.error("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Editar colaborador
          </DialogTitle>
          <DialogDescription>
            {collaborator.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nombre</Label>
            <Input
              id="edit-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <Separator />

          <PermissionToggles
            permissions={permissions}
            onChange={setPermissions}
            orgType={orgType}
          />

          <Separator />

          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            <div>
              <p className="text-sm font-medium">
                {collaborator.status === "active" ? "Cuenta activa" : "Cuenta suspendida"}
              </p>
              <p className="text-xs text-muted-foreground">
                {collaborator.status === "active"
                  ? "El colaborador puede acceder al sistema"
                  : "El colaborador no puede iniciar sesión"}
              </p>
            </div>
            <Button
              variant={collaborator.status === "active" ? "outline" : "default"}
              size="sm"
              onClick={handleToggleStatus}
              disabled={loading}
            >
              {collaborator.status === "active" ? "Suspender" : "Reactivar"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || displayName.trim().length < 2}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Section Component ────────────────────────────────────────────────────

export function CollaboratorsSection({ orgId, orgType }: CollaboratorsSectionProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Collaborator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collaborator | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collaborators?orgId=${orgId}`);
      if (!res.ok) return;
      const json = await res.json();
      setCollaborators(json.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  async function handleDelete(collaborator: Collaborator) {
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/collaborators/${collaborator.id}?orgId=${orgId}`,
        {
          method: "DELETE",
          headers: { "x-csrf-token": getCsrfToken() },
        }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al eliminar");
        return;
      }
      toast.success("Colaborador eliminado");
      setCollaborators((prev) => prev.filter((c) => c.id !== collaborator.id));
      setDeleteTarget(null);
    } catch {
      toast.error("Error de red.");
    } finally {
      setDeleteLoading(false);
    }
  }

  function countActivePerms(permissions: CollaboratorPermissions) {
    return (Object.values(permissions) as boolean[]).filter(Boolean).length;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle>Colaboradores</CardTitle>
                <CardDescription className="mt-0.5">
                  Crea cuentas para tu equipo con accesos configurados
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar colaborador
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : collaborators.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Aún no tienes colaboradores
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Agrega a tu equipo para que puedan acceder al sistema con permisos personalizados.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="mr-2 h-3.5 w-3.5" />
                Agregar primer colaborador
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {collaborators.map((c) => {
                const activeCount = countActivePerms(c.permissions);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(c.display_name ?? c.email ?? "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {c.display_name ?? c.email}
                          </p>
                          {c.status === "suspended" && (
                            <Badge variant="destructive" className="text-[10px] py-0">
                              Suspendido
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.email}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {activeCount === 0
                            ? "Sin accesos asignados"
                            : `${activeCount} permiso${activeCount !== 1 ? "s" : ""} activo${activeCount !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditTarget(c)}
                        title="Editar permisos"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(c)}
                        title="Eliminar colaborador"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info note */}
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Los colaboradores acceden con su propio email y contraseña. Pueden cambiar su contraseña
              en su página de Configuración. Tú controlas qué secciones y acciones tienen disponibles.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgId={orgId}
        orgType={orgType}
        onSuccess={(c) => setCollaborators((prev) => [...prev, c])}
      />

      {/* Edit dialog */}
      {editTarget && (
        <EditDialog
          collaborator={editTarget}
          orgId={orgId}
          orgType={orgType}
          onClose={() => setEditTarget(null)}
          onSuccess={(updated) => {
            setCollaborators((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
            setEditTarget(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la cuenta de{" "}
              <strong>{deleteTarget?.display_name ?? deleteTarget?.email}</strong>. Esta
              acción no se puede deshacer. El colaborador ya no podrá iniciar sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteLoading}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
