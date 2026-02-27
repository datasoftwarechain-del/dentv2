"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useCSRF } from "@/hooks/useCSRF";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  sender_type: "user" | "support";
  created_at: string;
  is_read: boolean;
}

interface Conversation {
  user_id: string;
  user_name: string;
  user_email: string;
  last_message: string;
  last_activity: string;
  unread_count: number;
}

export default function SupportAdminPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  const { csrfToken } = useCSRF();

  // Mantener ref sincronizado para usarlo dentro del closure de Realtime
  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  const loadConversations = useCallback(async () => {
    const r = await fetch("/api/support/admin/conversations");
    if (r.status === 403 || r.status === 401) {
      setIsAdmin(false);
      setLoadingConvs(false);
      return;
    }
    setIsAdmin(true);
    const data = await r.json();
    if (data?.conversations) setConversations(data.conversations);
    setLoadingConvs(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Suscripción Realtime global — escucha TODOS los mensajes nuevos
  useEffect(() => {
    if (isAdmin !== true) return;

    const supabase = createClient();
    const channel = supabase
      .channel("admin-support-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          const newMsg = payload.new as Message & { user_id: string };

          // Si el mensaje es del usuario seleccionado actualmente, agregarlo al chat
          if (newMsg.user_id === selectedUserIdRef.current) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === newMsg.id);
              return exists ? prev : [...prev, newMsg];
            });
          }

          // Actualizar sidebar de conversaciones
          setConversations((prev) => {
            const exists = prev.find((c) => c.user_id === newMsg.user_id);
            if (exists) {
              return prev.map((c) =>
                c.user_id === newMsg.user_id
                  ? {
                      ...c,
                      last_message: newMsg.content,
                      last_activity: newMsg.created_at,
                      unread_count:
                        newMsg.sender_type === "user" &&
                        newMsg.user_id !== selectedUserIdRef.current
                          ? c.unread_count + 1
                          : c.unread_count,
                    }
                  : c
              );
            }
            // Nueva conversación: recargar lista para obtener el nombre del usuario
            loadConversations();
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = useCallback(async (userId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/support/admin/messages?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setConversations((prev) =>
          prev.map((c) => (c.user_id === userId ? { ...c, unread_count: 0 } : c))
        );
      }
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const handleSelectConversation = (userId: string) => {
    setSelectedUserId(userId);
    loadMessages(userId);
  };

  const handleReply = async () => {
    const content = reply.trim();
    if (!content || !selectedUserId || sending) return;

    setSending(true);
    setReply("");

    try {
      const res = await fetch("/api/support/admin/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ userId: selectedUserId, content }),
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-slate-700">Acceso restringido</p>
          <p className="text-sm text-slate-500">Solo el equipo de soporte puede acceder a esta página.</p>
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#09919b]" />
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c.user_id === selectedUserId);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold text-slate-800">Soporte</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {conversations.length} conversación{conversations.length !== 1 ? "es" : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-[#09919b]" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <MessageCircle className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Sin conversaciones</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.user_id}
                onClick={() => handleSelectConversation(conv.user_id)}
                className={cn(
                  "w-full text-left p-4 border-b border-border hover:bg-slate-50 transition-colors",
                  selectedUserId === conv.user_id && "bg-[#f0fafb] border-l-2 border-l-[#09919b]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-[#d2f2f3] flex items-center justify-center shrink-0 text-[#09919b] text-xs font-bold">
                      {getInitials(conv.user_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {conv.user_name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{conv.user_email}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {conv.last_message}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-slate-400">
                      {formatDate(conv.last_activity)}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="h-5 w-5 rounded-full bg-[#09919b] text-white text-[10px] flex items-center justify-center font-semibold">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        {selectedUserId ? (
          <>
            <div className="p-4 border-b border-border bg-white flex items-center gap-3 shrink-0">
              <div className="h-9 w-9 rounded-full bg-[#d2f2f3] flex items-center justify-center text-[#09919b] text-xs font-bold">
                {selectedConv ? getInitials(selectedConv.user_name) : <User className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedConv?.user_name || selectedUserId}
                </p>
                <p className="text-xs text-slate-400">{selectedConv?.user_email}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-[#09919b]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <p className="text-sm">Sin mensajes aún</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.sender_type === "support" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          msg.sender_type === "support"
                            ? "bg-[#09919b] text-white rounded-br-sm"
                            : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                        )}
                      >
                        {msg.sender_type === "user" && (
                          <p className="text-[10px] font-semibold text-[#09919b] mb-1">
                            {selectedConv?.user_name || "Usuario"}
                          </p>
                        )}
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={cn(
                          "text-[10px] mt-1",
                          msg.sender_type === "support" ? "text-white/60 text-right" : "text-slate-400"
                        )}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="p-4 border-t border-border bg-white shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply()}
                  placeholder={`Responder a ${selectedConv?.user_name || "usuario"}...`}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:border-[#09919b] focus:ring-2 focus:ring-[#09919b]/20 outline-none text-sm transition-all disabled:opacity-50"
                />
                <Button
                  onClick={handleReply}
                  disabled={!reply.trim() || sending}
                  className="bg-[#09919b] hover:bg-[#044c64] text-white px-4 shrink-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <MessageCircle className="h-12 w-12 opacity-30" />
            <p className="text-sm">Selecciona una conversación</p>
          </div>
        )}
      </div>
    </div>
  );
}
