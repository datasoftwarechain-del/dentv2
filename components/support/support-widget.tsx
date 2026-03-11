"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useCSRF } from "@/hooks/useCSRF";
import { cn } from "@/lib/utils";

interface SupportMessage {
  id: string;
  content: string;
  sender_type: "user" | "support";
  created_at: string;
  is_read: boolean;
}

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { csrfToken } = useCSRF();

  // Escuchar evento desde el botón de settings
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-support-chat", handler);
    return () => window.removeEventListener("open-support-chat", handler);
  }, []);

  // Obtener user_id actual
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    }).catch(() => {});
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar mensajes y suscripción Realtime al abrir
  useEffect(() => {
    if (!isOpen || !userId) return;

    loadMessages();

    const supabase = createClient();
    const channel = supabase
      .channel(`support-user-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const newMsg = payload.new as SupportMessage;
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newMsg.id);
            return exists ? prev : [...prev, newMsg];
          });
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn("[SupportWidget] Realtime:", err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, userId, loadMessages]);

  // Scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setInput("");

    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.message.id);
          return exists ? prev : [...prev, data.message];
        });
      }
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Panel de chat */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ height: "520px" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#044c64] to-[#09919b] p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Soporte DigitalDent</h3>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-emerald-400 rounded-full" />
                  <span className="text-white/80 text-xs">En línea</span>
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

          {/* Área de mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-[#09919b]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <p className="text-sm text-slate-700 font-medium mb-1">
                    👋 ¡Hola! ¿En qué podemos ayudarte?
                  </p>
                  <p className="text-xs text-slate-500">
                    Escríbenos y te responderemos a la brevedad.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Temas frecuentes
                  </p>
                  {[
                    "📋 Ayuda con órdenes",
                    "💰 Consultas de facturación",
                    "🔧 Problemas técnicos",
                  ].map((topic) => (
                    <button
                      key={topic}
                      onClick={() => setInput(topic)}
                      className="w-full text-left px-4 py-3 rounded-lg bg-white border border-slate-200 hover:border-[#09919b] hover:bg-[#f0fafb] transition-all text-sm text-slate-700"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.sender_type === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                        msg.sender_type === "user"
                          ? "bg-[#09919b] text-white rounded-br-sm"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                      )}
                    >
                      {msg.sender_type === "support" && (
                        <p className="text-[10px] font-semibold text-[#09919b] mb-1">
                          Soporte
                        </p>
                      )}
                      <p className="leading-relaxed">{msg.content}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          msg.sender_type === "user"
                            ? "text-white/60 text-right"
                            : "text-slate-400"
                        )}
                      >
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 bg-white shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Escribe tu consulta..."
                disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:border-[#09919b] focus:ring-2 focus:ring-[#09919b]/20 outline-none text-sm transition-all disabled:opacity-50"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="bg-[#09919b] hover:bg-[#044c64] text-white px-4 shrink-0"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
