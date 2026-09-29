"use client";

/**
 * [042_designers] Formulario público "soy diseñador".
 *
 * No crea cuenta: deja una postulación que el estudio revisa. Por eso no
 * pide contraseña ni sube archivos. El portfolio va como enlace, que es
 * como los diseñadores ya muestran su trabajo.
 *
 * La clave de idempotencia se genera UNA vez por montaje: si el visitante
 * hace doble clic o reintenta tras un error de red, el servidor devuelve
 * la misma postulación en lugar de crear dos.
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

/** Software declarable. Lista corta y abierta: "Otro" va en el comentario. */
const SOFTWARE = ["exocad", "3Shape", "Meshmixer", "Blender", "Dental Wings", "inLab", "Zirkonzahn"];

/**
 * [045] Las especialidades son las CATEGORÍAS del catálogo de diseño, no
 * texto libre. El bot elige diseñador comparando la categoría del caso
 * contra lo que cada uno declaró; si acá se guardaran etiquetas inventadas
 * ("All-on-X", "Ortodoncia") nunca coincidirían con nada y el criterio de
 * especialidad quedaría muerto sin que se notara.
 */
const SPECIALTIES: Array<{ value: string; label: string }> = [
  { value: "restaurador", label: "Coronas, puentes y carillas" },
  { value: "implantes", label: "Implantes y pilares" },
  { value: "removible", label: "Prótesis removible" },
  { value: "otros", label: "Férulas, cubetas y modelos" },
];

function csrf(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function Chip({
  label, checked, onToggle,
}: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        checked
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function DesignerApplicationForm() {
  // Se fija al montar: reintentar no debe crear una postulación nueva.
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [years, setYears] = useState("");
  const [software, setSoftware] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState("");
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const canSubmit =
    fullName.trim().length >= 2 && /.+@.+\..+/.test(email.trim()) && accepted && !isSending;

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit() {
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/designer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({
          website,
          idempotency_key: idempotencyKey.current,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          country: "UY",
          city: city.trim() || null,
          years_experience: years.trim() === "" ? null : Number(years),
          software,
          specialties,
          portfolio_url: portfolio.trim(),
          notes: notes.trim() || null,
          accepted_terms: true,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo enviar la postulación");

      setDone(payload?.application_number ?? "recibida");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la postulación");
    } finally {
      setIsSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">Postulación recibida</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Quedó registrada como <strong>{done}</strong>. Revisamos las postulaciones y te
          escribimos al email que dejaste.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) void handleSubmit();
      }}
    >
      {/* Honeypot: fuera de la vista y del foco, pero no display:none
          (algunos bots ignoran los campos ocultos así). */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="website">No completar</label>
        <input
          id="website" name="website" tabIndex={-1} autoComplete="off"
          value={website} onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Tus datos</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre y apellido *</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Tu experiencia</legend>
        <div className="space-y-2 sm:max-w-[200px]">
          <Label htmlFor="years">Años diseñando</Label>
          <Input
            id="years" type="number" min={0} max={60} inputMode="numeric"
            value={years} onChange={(e) => setYears(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Software que usás</span>
          <div className="flex flex-wrap gap-2">
            {SOFTWARE.map((s) => (
              <Chip key={s} label={s} checked={software.includes(s)} onToggle={() => toggle(software, setSoftware, s)} />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Trabajos que hacés</span>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                checked={specialties.includes(s.value)}
                onToggle={() => toggle(specialties, setSpecialties, s.value)}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="portfolio">Portfolio o perfil (enlace)</Label>
          <Input
            id="portfolio" type="url" placeholder="https://" value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)} maxLength={300}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Contanos algo más</Label>
          <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </div>
      </fieldset>

      <div className="flex items-start gap-3">
        <Checkbox id="terms" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
        <Label htmlFor="terms" className="text-sm font-normal leading-relaxed text-muted-foreground">
          Acepto que DigitalDent guarde estos datos para evaluar mi postulación y contactarme.
        </Label>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={!canSubmit} className="w-full gap-2 sm:w-auto">
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isSending ? "Enviando…" : "Enviar postulación"}
        {!isSending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </Button>
    </form>
  );
}
