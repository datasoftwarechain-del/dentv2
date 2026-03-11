"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Combobox } from "@/components/ui/combobox";
import { Eye, EyeOff, RefreshCw, Copy, Check, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DentistOption {
  value: string;
  label: string;
}

interface Invitation {
  id: string;
  invited_email: string;
  display_name: string;
  status: "pending" | "active" | "converted" | "revoked";
  created_at: string;
  dentist_org: { id: string; name: string } | null;
}

interface PortalSectionProps {
  dentistOptions: DentistOption[];
  invitations: Invitation[];
  labOrgId: string;
}

// ─── Validation schema ────────────────────────────────────────────────────────

const schema = z.object({
  dentistOrgId: z.string().min(1, "Seleccioná una clínica"),
  displayName: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Al menos una mayúscula")
    .regex(/[0-9]/, "Al menos un número"),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCsrfToken(): string {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function generateSecurePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;

  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);

  let pwd = "";
  pwd += upper[arr[0] % upper.length];
  pwd += digits[arr[1] % digits.length];
  pwd += symbols[arr[2] % symbols.length];
  for (let i = 3; i < 12; i++) {
    pwd += all[arr[i] % all.length];
  }

  // Shuffle
  const chars = pwd.split("");
  const shuffle = new Uint32Array(chars.length);
  crypto.getRandomValues(shuffle);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  active: "Activo",
  converted: "Convertido",
  revoked: "Revocado",
};

const STATUS_VARIANTS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  active: "bg-green-100 text-green-800 border-green-200",
  converted: "bg-[#43eada]/20 text-[#044c64] border-[#43eada]/40",
  revoked: "bg-slate-100 text-slate-500 border-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_VARIANTS[status] ?? "bg-slate-100 text-slate-500"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PortalSection({ dentistOptions, invitations: initialInvitations, labOrgId }: PortalSectionProps) {
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Success dialog state
  const [successDialog, setSuccessDialog] = useState<{
    open: boolean;
    email: string;
    password: string;
    displayName: string;
  }>({ open: false, email: "", password: "", displayName: "" });
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dentistOrgId: "", displayName: "", email: "", password: "" },
  });

  const selectedDentistId = watch("dentistOrgId");
  const passwordValue = watch("password");

  // Pre-fill display name when a clinic is selected
  const handleDentistChange = (value: string) => {
    setValue("dentistOrgId", value, { shouldValidate: false });
    const opt = dentistOptions.find((o) => o.value === value);
    if (opt) {
      setValue("displayName", opt.label, { shouldValidate: false });
    }
  };

  const handleGeneratePassword = () => {
    const pwd = generateSecurePassword();
    setValue("password", pwd, { shouldValidate: true });
    setShowPassword(true);
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/portal/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        setSubmitError(json.error ?? "Error desconocido");
        return;
      }

      // Show success dialog with credentials
      setSuccessDialog({
        open: true,
        email: data.email,
        password: data.password,
        displayName: data.displayName,
      });

      // Refresh invitations list optimistically
      const clinic = dentistOptions.find((o) => o.value === data.dentistOrgId);
      const newInv: Invitation = {
        id: Math.random().toString(),
        invited_email: data.email,
        display_name: data.displayName,
        status: "active",
        created_at: new Date().toISOString(),
        dentist_org: clinic ? { id: data.dentistOrgId, name: clinic.label } : null,
      };
      setInvitations((prev) => [newInv, ...prev]);

      reset();
    } catch {
      setSubmitError("Error al conectar con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch(`/api/portal/invitations/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
        credentials: "include",
      });

      if (res.ok) {
        setInvitations((prev) =>
          prev.map((inv) => (inv.id === id ? { ...inv, status: "revoked" as const } : inv))
        );
      }
    } catch {
      // silently fail — user will see the status hasn't changed
    }
  };

  const handleCopyCredentials = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = `Portal DigitalDent\nEmail: ${successDialog.email}\nContraseña: ${successDialog.password}\nURL: ${origin}/auth/login`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#044c64]">Portal de Clínicas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Creá accesos de vista previa para que tus clínicas conectadas puedan ver sus órdenes y trabajo en progreso.
          </p>
        </div>

        <Tabs defaultValue="create">
          <TabsList className="mb-4">
            <TabsTrigger value="create">Crear acceso</TabsTrigger>
            <TabsTrigger value="active">
              Accesos activos
              {invitations.filter((i) => i.status === "active").length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#044c64] text-[10px] font-bold text-white">
                  {invitations.filter((i) => i.status === "active").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab: Crear acceso ─────────────────────────────────────────── */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nuevo acceso de vista previa</CardTitle>
                <CardDescription>
                  Se creará una cuenta con acceso limitado para que la clínica pueda revisar sus órdenes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Clinic selector */}
                  <div className="space-y-1.5">
                    <Label htmlFor="dentistOrgId">Clínica</Label>
                    <Combobox
                      id="dentistOrgId"
                      options={dentistOptions}
                      value={selectedDentistId}
                      onValueChange={handleDentistChange}
                      placeholder="Seleccioná una clínica..."
                      searchPlaceholder="Buscar clínica..."
                      emptyText="No se encontraron clínicas"
                    />
                    {errors.dentistOrgId && (
                      <p className="text-xs text-destructive">{errors.dentistOrgId.message}</p>
                    )}
                  </div>

                  {/* Display name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName">Nombre para mostrar</Label>
                    <Input
                      id="displayName"
                      placeholder="Ej: Dr. García - Clínica Norte"
                      {...register("displayName")}
                    />
                    {errors.displayName && (
                      <p className="text-xs text-destructive">{errors.displayName.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email de acceso</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="clinica@ejemplo.com"
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 8 caracteres"
                          className="pr-10"
                          {...register("password")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGeneratePassword}
                        className="shrink-0 gap-1.5 text-xs border-[#09919b]/30 text-[#044c64] hover:bg-[#43eada]/5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Generar
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Mínimo 8 caracteres, al menos una mayúscula y un número.
                    </p>
                  </div>

                  {submitError && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#044c64] hover:bg-[#033d52] text-white"
                  >
                    {isSubmitting ? "Creando acceso..." : "Crear acceso de vista previa"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tab: Accesos activos ──────────────────────────────────────── */}
          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Accesos creados</CardTitle>
                <CardDescription>
                  Listado de todas las cuentas de vista previa creadas para tus clínicas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <p className="text-sm">No hay accesos creados todavía.</p>
                    <p className="text-xs mt-1">Usá la pestaña "Crear acceso" para generar el primero.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 pr-4 font-medium text-muted-foreground">Clínica</th>
                          <th className="pb-3 pr-4 font-medium text-muted-foreground">Email</th>
                          <th className="pb-3 pr-4 font-medium text-muted-foreground">Estado</th>
                          <th className="pb-3 pr-4 font-medium text-muted-foreground">Creado</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {invitations.map((inv) => (
                          <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 pr-4 font-medium text-[#044c64]">
                              {inv.dentist_org?.name ?? inv.display_name}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">{inv.invited_email}</td>
                            <td className="py-3 pr-4">
                              <StatusBadge status={inv.status} />
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {new Date(inv.created_at).toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3 text-right">
                              {inv.status !== "revoked" && inv.status !== "converted" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
                                    >
                                      Revocar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Revocar acceso</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esto deshabilitará la cuenta de vista previa de{" "}
                                        <strong>{inv.invited_email}</strong>. La clínica ya no podrá
                                        iniciar sesión. Esta acción no se puede deshacer fácilmente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleRevoke(inv.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Revocar acceso
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Success dialog with credentials ──────────────────────────────── */}
      <Dialog open={successDialog.open} onOpenChange={(open) => !open && setSuccessDialog((s) => ({ ...s, open: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#044c64]">Acceso creado correctamente</DialogTitle>
            <DialogDescription>
              Compartí estas credenciales con la clínica. Guardálas ahora — la contraseña no se volverá a mostrar.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 rounded-xl border border-[#09919b]/20 bg-[#43eada]/5 p-4 font-mono text-sm space-y-1">
            <p className="font-semibold text-[#044c64] mb-2 font-sans">Portal DigitalDent</p>
            <p>
              <span className="text-muted-foreground">Email: </span>
              <span className="text-foreground">{successDialog.email}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Contraseña: </span>
              <span className="text-foreground">{successDialog.password}</span>
            </p>
            <p>
              <span className="text-muted-foreground">URL: </span>
              <span className="text-foreground">
                {typeof window !== "undefined" ? window.location.origin : ""}/auth/login
              </span>
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleCopyCredentials}
              className={cn(
                "gap-2 transition-all",
                copied
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-[#044c64] hover:bg-[#033d52] text-white"
              )}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar credenciales
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
