"use client";

import { Icon } from "@iconify/react";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const WHATSAPP_MESSAGE = "Hola, necesito ayuda con DigitalDent.";

export function WhatsAppButton() {
  if (!WHATSAPP_NUMBER) return null;

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-[#20ba57] transition-colors"
      aria-label="Contactar por WhatsApp"
    >
      <Icon icon="mdi:whatsapp" className="h-4 w-4" />
      WhatsApp
    </a>
  );
}
