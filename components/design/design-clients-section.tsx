"use client";

/**
 * [035_design_studio] Cartera de clientes del estudio.
 *
 * El alta es por email: buscar organizaciones por nombre permitiría
 * enumerar los inquilinos de la plataforma. Si ese email todavía no
 * tiene cuenta, se la crea acá mismo con el nombre de la clínica — sin
 * eso el estudio no puede arrancar, porque nadie se registra solo en un
 * sistema donde todavía no tiene nada que hacer.
 *
 * No hay botón de borrar. Suspender corta el envío de casos nuevos sin
 * romper las órdenes y facturas que ese cliente ya tiene.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Plus, Loader2, PauseCircle, PlayCircle } from "lucide-react";

interface ClientRow {
  id: string;
  status: "active" | "suspended";
  payment_mode: "account" | "prepaid";
  turnaround_hours: number | null;
  notes: string | null;
  client_org: { id: string; name: string; type: string } | { id: string; name: string; type: string }[] | null;
}

const ORG_TYPE_LABELS: Record<string, string> = {
  dentist: "Consultorio",
  lab: "Laboratorio",
  design_studio: "Estudio de diseño",
  dentist_preview: "Vitrina",
};

function csrf(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function DesignClientsSection({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [contactName, setContactName] = useState("");
  const [clientType, setClientType] = useState<"dentist" | "lab">("dentist");
  const [paymentMode, setPaymentMode] = useState<"account" | "prepaid">("account");
  const [turnaround, setTurnaround] = useState("");
  const [notes, setNotes] = useState("");
  /** Enlace de acceso devuelto cuando se crea una cuenta nueva. */
  const [accessUrl, setAccessUrl] = useState<string | null>(null);

  async function handleAdd() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/design/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({
          email: email.trim(),
          clinic_name: clinicName.trim() || null,
          contact_name: contactName.trim() || null,
          client_type: clientType,
          payment_mode: paymentMode,
          turnaround_hours: turnaround ? Number(turnaround) : null,
          notes: notes.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo habilitar al cliente");

      const org = one(payload.data?.client_org);

      if (payload?.created_account && payload?.access_url) {
        // La cuenta es nueva: el estudio necesita el enlace para
        // pasárselo. Se muestra en vez de cerrar el diálogo.
        setAccessUrl(payload.access_url);
        toast.success(`${org?.name ?? "Cliente"} creado y habilitado`);
      } else {
        toast.success(`${org?.name ?? "Cliente"} habilitado`);
        setIsOpen(false);
        resetForm();
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al habilitar");
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setEmail("");
    setClinicName("");
    setContactName("");
    setNotes("");
    setTurnaround("");
    setAccessUrl(null);
  }

  async function toggleStatus(row: ClientRow) {
    const next = row.status === "active" ? "suspended" : "active";
    setBusyId(row.id);
    try {
      const response = await fetch(`/api/design/clients/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({ status: next }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo actualizar");

      toast.success(next === "active" ? "Cliente reactivado" : "Cliente suspendido");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Clientes del estudio</CardTitle>
            <CardDescription>
              Solo las organizaciones habilitadas acá pueden enviarte casos.
            </CardDescription>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Habilitar cliente
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Habilitar un cliente</DialogTitle>
                <DialogDescription>
                  Indicá el email de alguien que ya tenga cuenta. Se habilita su
                  organización entera, no solo a esa persona.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="client-email">Email del cliente</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto@clinica.com"
                  />
                  <p className="text-xs text-slate-500">
                    Si ya tiene cuenta, se habilita su organización. Si no, se crea.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="clinic-name">Clínica o laboratorio</Label>
                    <Input
                      id="clinic-name"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="Clínica Dental Norte"
                      maxLength={160}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client-type">Tipo</Label>
                    <Select
                      value={clientType}
                      onValueChange={(v) => setClientType(v as "dentist" | "lab")}
                    >
                      <SelectTrigger id="client-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dentist">Clínica / consultorio</SelectItem>
                        <SelectItem value="lab">Laboratorio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">Persona de contacto (opcional)</Label>
                  <Input
                    id="contact-name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    maxLength={120}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment-mode">Forma de cobro</Label>
                  <Select
                    value={paymentMode}
                    onValueChange={(v) => setPaymentMode(v as "account" | "prepaid")}
                  >
                    <SelectTrigger id="payment-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="account">Cuenta corriente</SelectItem>
                      <SelectItem value="prepaid">Pago por adelantado</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    En pago adelantado el STL no se puede descargar hasta que la factura esté paga.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="turnaround">Plazo comprometido en horas (opcional)</Label>
                  <Input
                    id="turnaround"
                    type="number"
                    min={1}
                    max={720}
                    value={turnaround}
                    onChange={(e) => setTurnaround(e.target.value)}
                    placeholder="48"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-notes">Notas (opcional)</Label>
                  <Textarea
                    id="client-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={1000}
                  />
                </div>
              </div>

              {accessUrl && (
                <div className="space-y-2 rounded-lg border border-[#b0dde0] bg-[#e0f4f6]/50 p-3">
                  <p className="text-sm font-medium text-[#044c64]">
                    Cuenta creada. Pasale este enlace para que entre:
                  </p>
                  <div className="flex gap-2">
                    <Input readOnly value={accessUrl} className="text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(accessUrl);
                        toast.success("Enlace copiado");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-[#0d687d]">
                    Es de un solo uso. Al abrirlo define su contraseña y entra a su panel.
                  </p>
                </div>
              )}

              <DialogFooter>
                {accessUrl ? (
                  <Button onClick={() => { setIsOpen(false); resetForm(); }}>
                    Listo
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAdd} disabled={isSaving || !email.includes("@")}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Habilitar
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Building2 className="h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="font-medium text-slate-700">Todavía no hay clientes habilitados</p>
            <p className="max-w-sm text-sm text-slate-500">
              Hasta que habilites a alguien, nadie puede enviarte casos de diseño.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {clients.map((row) => {
              const org = one(row.client_org);
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{org?.name ?? "—"}</p>
                    <p className="text-xs text-slate-500">
                      {ORG_TYPE_LABELS[org?.type ?? ""] ?? org?.type}
                      {" · "}
                      {row.payment_mode === "prepaid" ? "Pago adelantado" : "Cuenta corriente"}
                      {row.turnaround_hours ? ` · ${row.turnaround_hours} h de plazo` : ""}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={
                      row.status === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-500"
                    }
                  >
                    {row.status === "active" ? "Activo" : "Suspendido"}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStatus(row)}
                    disabled={busyId === row.id}
                  >
                    {busyId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : row.status === "active" ? (
                      <>
                        <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                        Suspender
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        Reactivar
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
