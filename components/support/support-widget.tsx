"use client";

import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (!message.trim()) return;

    // Aquí puedes integrar con tu sistema de soporte
    console.log("Mensaje de soporte:", message);
    setMessage("");

    // Podrías redirigir a un email o chat real
    window.location.href = `mailto:soporte@digitaldent.com?subject=Solicitud de Soporte&body=${encodeURIComponent(message)}`;
  };

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-[#09919b] to-[#044c64] text-white shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group"
          aria-label="Abrir chat de soporte"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-400 rounded-full animate-pulse" />
        </button>
      )}

      {/* Panel de chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#044c64] to-[#09919b] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Soporte DigitalDent</h3>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-emerald-400 rounded-full" />
                  <span className="text-white/80 text-xs">Disponible</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Contenido */}
          <div className="p-6 flex-1 bg-gradient-to-b from-slate-50 to-white">
            <div className="space-y-4">
              {/* Mensaje de bienvenida */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <p className="text-sm text-slate-700 font-medium mb-2">
                  👋 ¡Hola! ¿En qué podemos ayudarte?
                </p>
                <p className="text-xs text-slate-500">
                  Nuestro equipo de soporte está disponible para resolver tus dudas.
                </p>
              </div>

              {/* Opciones rápidas */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Temas frecuentes
                </p>
                <button className="w-full text-left px-4 py-3 rounded-lg bg-white border border-slate-200 hover:border-[#09919b] hover:bg-[#f0fafb] transition-all text-sm text-slate-700">
                  📋 Ayuda con órdenes
                </button>
                <button className="w-full text-left px-4 py-3 rounded-lg bg-white border border-slate-200 hover:border-[#09919b] hover:bg-[#f0fafb] transition-all text-sm text-slate-700">
                  💰 Consultas de facturación
                </button>
                <button className="w-full text-left px-4 py-3 rounded-lg bg-white border border-slate-200 hover:border-[#09919b] hover:bg-[#f0fafb] transition-all text-sm text-slate-700">
                  🔧 Problemas técnicos
                </button>
              </div>
            </div>
          </div>

          {/* Input de mensaje */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Escribe tu consulta..."
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:border-[#09919b] focus:ring-2 focus:ring-[#09919b]/20 outline-none text-sm transition-all"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="bg-[#09919b] hover:bg-[#044c64] text-white px-4"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              O escríbenos a <a href="mailto:soporte@digitaldent.com" className="text-[#09919b] hover:underline">soporte@digitaldent.com</a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
