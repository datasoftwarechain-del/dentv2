"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCSRF } from "@/hooks/useCSRF";

const ROLES = [
  { value: "", label: "Soy... (opcional)" },
  { value: "dentist", label: "Odontólogo/a" },
  { value: "clinic", label: "Clínica dental" },
  { value: "lab", label: "Laboratorio dental" },
  { value: "other", label: "Otro" },
];

type ChatState = "closed" | "open" | "success";

export function ChatWidget() {
  const { csrfToken } = useCSRF();
  const [state, setState] = useState<ChatState>("closed");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    message: "",
    name: "",
    phone: "",
    email: "",
    role: "",
    wants_contact: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || form.message.length < 10) return;

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
          message: form.message,
          source: "chat",
          wants_contact: form.wants_contact,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error desconocido");
      }

      setState("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al enviar. Intenta de nuevo.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setState("closed");
    // Reset form on close from success
    if (state === "success") {
      setForm({ message: "", name: "", phone: "", email: "", role: "", wants_contact: false });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Chat panel */}
      <AnimatePresence>
        {state !== "closed" && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-[320px] sm:w-[340px] overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl shadow-black/20"
            style={{ transformOrigin: "bottom right" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-primary to-secondary px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <MessageCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">DigitalDent</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true" />
                    <p className="text-[11px] text-white/80">Online</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Cerrar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <AnimatePresence mode="wait">
              {state === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="flex flex-col items-center gap-4 px-5 py-8 text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
                    <CheckCircle2 className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">¡Gracias por escribirnos!</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Te respondemos a la brevedad por email.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    className="mt-1 w-full"
                  >
                    Cerrar
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 py-4"
                >
                  {/* Welcome bubble */}
                  <div className="mb-4 rounded-xl rounded-tl-none bg-muted/60 px-3.5 py-2.5 text-sm text-foreground/80">
                    ¡Hola! 👋 ¿En qué podemos ayudarte hoy?
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                    <textarea
                      placeholder="Tu consulta... (mín. 10 caracteres)"
                      required
                      minLength={10}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      rows={3}
                      className="focus-ring w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                      aria-label="Consulta"
                    />

                    <Input
                      type="text"
                      placeholder="Tu nombre (opcional)"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="focus-ring h-9 text-sm"
                      aria-label="Nombre"
                    />

                    <Input
                      type="tel"
                      placeholder="Teléfono (opcional)"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="focus-ring h-9 text-sm"
                      aria-label="Teléfono"
                    />

                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="focus-ring h-9 text-sm"
                      aria-label="Email"
                    />

                    <select
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="focus-ring h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
                      aria-label="Rol"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>

                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                      <input
                        type="checkbox"
                        checked={form.wants_contact}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, wants_contact: e.target.checked }))
                        }
                        className="h-3.5 w-3.5 rounded border-input accent-primary"
                      />
                      Quiero que me contacten pronto
                    </label>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={loading}
                      className="mt-0.5 w-full gap-1.5 premium-transition"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      {loading ? "Enviando..." : "Enviar consulta"}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <div className="relative">
        {/* Pulsing green dot */}
        {state === "closed" && (
          <span
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-green-400 ring-2 ring-background animate-pulse"
            aria-hidden="true"
          />
        )}
        <motion.button
          onClick={() => setState(state === "closed" ? "open" : "closed")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition-shadow hover:shadow-2xl hover:shadow-primary/40"
          aria-label={state === "closed" ? "Abrir chat de soporte" : "Cerrar chat"}
          aria-expanded={state !== "closed"}
        >
          <AnimatePresence mode="wait" initial={false}>
            {state === "closed" ? (
              <motion.span
                key="open-icon"
                initial={{ rotate: -30, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 30, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <MessageCircle className="h-6 w-6" />
              </motion.span>
            ) : (
              <motion.span
                key="close-icon"
                initial={{ rotate: 30, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -30, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <X className="h-6 w-6" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Tooltip */}
        {state === "closed" && (
          <div
            className="pointer-events-none absolute bottom-0 right-16 whitespace-nowrap rounded-lg bg-foreground/90 px-2.5 py-1 text-xs text-background opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            role="tooltip"
          >
            ¿Necesitás ayuda?
          </div>
        )}
      </div>
    </div>
  );
}
