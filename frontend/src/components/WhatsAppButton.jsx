import { waLink } from "@/lib/format";

export function WhatsAppIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A10 10 0 0 0 12.04 2C6.58 2 2.14 6.43 2.14 11.88c0 2.09.55 4.13 1.6 5.93L2 22l4.31-1.12a9.91 9.91 0 0 0 5.73 1.83h.01c5.46 0 9.91-4.43 9.91-9.88a9.84 9.84 0 0 0-2.91-7.01zm-7.01 15.2h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-2.56.67.68-2.49-.19-.32a8.18 8.18 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.17 8.17 0 0 1 2.42 5.83c0 4.54-3.7 8.22-8.25 8.22zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.79.96-.14.17-.29.18-.54.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.55.12.17 1.73 2.65 4.2 3.72.58.25 1.04.4 1.4.51.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z"/>
    </svg>
  );
}

export default function WhatsAppButton({ whatsapp, message, label = "Chamar no WhatsApp", className = "", "data-testid": testId, size = "lg" }) {
  if (!whatsapp) return null;
  const sizeCls = size === "lg" ? "px-8 py-5 text-base" : "px-5 py-3 text-sm";
  return (
    <a
      href={waLink(whatsapp, message)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className={`inline-flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold uppercase tracking-tight transition-colors ${sizeCls} ${className}`}
    >
      <WhatsAppIcon size={size === "lg" ? 24 : 18} />
      <span>{label}</span>
    </a>
  );
}
