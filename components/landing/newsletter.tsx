"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Users, Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCSRF } from "@/hooks/useCSRF";

const ROLES = [
  { value: "", label: "Tu rol (opcional)" },
  { value: "dentist", label: "Odontólogo/a" },
  { value: "clinic", label: "Clínica dental" },
  { value: "lab", label: "Laboratorio dental" },
  { value: "other", label: "Otro" },
];

const perks = [
  { icon: Zap, text: "Tendencias y novedades del sector" },
  { icon: Users, text: "Tips de gestión clínica y laboratorio" },
  { icon: ShieldCheck, text: "Sin spam. Cancelá cuando quieras." },
];

export function Newsletter() {
  const { csrfToken } = useCSRF();
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    role: "",
    wants_contact: false,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          email: form.email,
          name: form.name || undefined,
          phone: form.phone || undefined,
          role: form.role || undefined,
          source: "newsletter",
          wants_contact: form.wants_contact,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error desconocido");
      }

      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al suscribirte. Intenta de nuevo.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <p className="section-label mb-3">Newsletter</p>
            <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              Lo mejor del sector dental,{" "}
              <span className="text-primary">en tu bandeja de entrada.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Únete a los profesionales que ya están un paso adelante.
              Contenido práctico, sin ruido.
            </p>

            <ul className="mt-8 flex flex-col gap-4">
              {perks.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right — form */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="glass-card rounded-2xl p-7 sm:p-8">
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="flex flex-col items-center gap-4 py-8 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
                      <CheckCircle2 className="h-7 w-7 text-accent" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">¡Ya estás en la lista!</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Te enviaremos lo mejor del sector dental. Sin spam, prometido.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="text"
                        placeholder="Nombre (opcional)"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="focus-ring"
                        aria-label="Nombre"
                      />
                      <Input
                        type="tel"
                        placeholder="Teléfono (opcional)"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="focus-ring"
                        aria-label="Teléfono"
                      />
                    </div>

                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="focus-ring"
                      aria-label="Email"
                    />

                    <select
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="focus-ring h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      aria-label="Rol"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>

                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground select-none">
                      <input
                        type="checkbox"
                        checked={form.wants_contact}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, wants_contact: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      Quiero que el equipo se contacte conmigo
                    </label>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="mt-1 w-full premium-transition"
                    >
                      {loading ? "Suscribiendo..." : "Suscribirme gratis"}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground/60">
                      Sin tarjeta · Sin compromisos · Cancelá cuando quieras
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
