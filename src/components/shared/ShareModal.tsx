"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/* ─── Icons ─── */
const TelegramIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M21.8 2.6 2.3 10.1c-1.3.5-1.3 1.3-.2 1.6l4.8 1.5 11.1-7c.5-.3 1 0 .6.4l-9 8.1-.3 5c.4 0 .9-.2 1.2-.5l2.8-2.7 5 3.7c.9.5 1.5.2 1.8-.8L23.2 4c.3-1.3-.5-1.9-1.4-1.4z"
      fill="currentColor"
    />
  </svg>
);

const WhatsAppIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.1-1.34A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.08 13.84c-.22.62-1.3 1.2-1.8 1.26-.47.06-1.07.08-1.72-.1a15.9 15.9 0 01-1.57-.58c-2.75-1.19-4.55-3.97-4.69-4.15-.14-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.98.95-2.25.25-.27.55-.34.73-.34h.53c.17 0 .4-.07.63.47.24.56.8 1.95.87 2.1.07.14.12.32.02.52-.1.2-.15.33-.3.5-.14.18-.3.4-.43.53-.14.14-.29.3-.12.58.17.27.74 1.22 1.58 1.97.9.8 1.65 1.05 1.88 1.17.23.12.36.1.5-.06.13-.16.57-.66.72-.89.15-.23.3-.19.5-.11.2.07 1.28.6 1.5.71.22.11.37.17.43.27.06.1.06.56-.16 1.19z" />
  </svg>
);

const FacebookIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.27h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
  </svg>
);

const LinkIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

const ShareMoreIcon = ({ size = 19 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" />
  </svg>
);

const CheckIcon = ({ size = 17 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/* ─── Design tokens (mirroring the design system) ─── */
const T = {
  ink: "#141210",
  ink2: "rgba(20,18,16,.65)",
  ink3: "rgba(20,18,16,.45)",
  line: "rgba(20,18,16,.10)",
  line2: "rgba(20,18,16,.16)",
  paper: "#FAF7F1",
  bg: "#F0EBE0",
  accentDeep: "#C2522A",
} as const;

/* ─── Platform list ─── */
const PLATFORMS = [
  {
    id: "tg",
    label: "Telegram",
    bg: "rgba(34,158,217,.13)",
    color: "#1178A8",
    icon: TelegramIcon,
    buildUrl: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "wa",
    label: "WhatsApp",
    bg: "rgba(37,211,102,.13)",
    color: "#1A9B52",
    icon: WhatsAppIcon,
    buildUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
] as const;

/* ─── Props ─── */
export type ShareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
  subtitle?: string;
  /** Подсвеченное слово в заголовке (творительный падеж): «событием» | «местом» | «предложением». */
  entityNoun?: string;
};

/* ─── Inner content (Variant B — Editorial) ─── */
function ShareContent({
  url,
  title,
  subtitle,
  entityNoun = "событием",
  onClose,
}: Omit<ShareModalProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const hasNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const shareText = subtitle ? `${title} — ${subtitle}` : title;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement("input");
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // silently fail
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: shareText, url });
    } catch {
      // user cancelled
    }
  };

  /* shared opt-row style */
  const optBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
    padding: "11px 14px",
    background: T.paper,
    border: `1px solid ${T.line}`,
    borderRadius: 16,
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color .18s",
  };

  return (
    <div style={{ padding: "26px 26px 24px" }}>
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Закрыть"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 32,
          height: 32,
          borderRadius: 99,
          background: T.bg,
          border: "none",
          cursor: "pointer",
          color: T.ink3,
          fontSize: 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ✕
      </button>

      {/* Serif heading */}
      <h2
        style={{
          margin: "0 0 6px",
          fontSize: 38,
          lineHeight: 1,
          letterSpacing: "-.025em",
          color: T.ink,
          paddingRight: 40,
          fontFamily: "var(--font-sans), sans-serif",
          fontWeight: 600,
        }}
      >
        Поде&shy;литься{" "}
        <span
          style={{
            fontFamily: "var(--font-editorial)",
            fontStyle: "italic",
            fontWeight: 400,
            color: T.accentDeep,
          }}
        >
          {entityNoun}
        </span>
      </h2>
      <p
        style={{
          margin: "0 0 22px",
          fontSize: 13,
          color: T.ink3,
          lineHeight: 1.5,
        }}
      >
        Отправьте друзьям или скопируйте ссылку
      </p>

      {/* Platform rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          return (
            <a
              key={p.id}
              href={p.buildUrl(url, shareText)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...optBase, textDecoration: "none" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = T.ink)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = T.line)
              }
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: p.bg,
                  color: p.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={20} />
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.ink,
                  letterSpacing: "-.01em",
                }}
              >
                {p.label}
              </span>
              <span style={{ color: T.ink3, fontSize: 16 }}>→</span>
            </a>
          );
        })}
      </div>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          margin: "18px 0 14px",
        }}
      >
        <span style={{ flex: 1, height: 1, background: T.line }} />
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink3,
          }}
        >
          или
        </span>
        <span style={{ flex: 1, height: 1, background: T.line }} />
      </div>

      {/* Copy link — card with URL preview */}
      <button
        onClick={handleCopy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          padding: "13px 16px",
          background: copied ? "rgba(31,138,91,.07)" : T.paper,
          border: `1px solid ${copied ? "rgba(31,138,91,.35)" : T.line}`,
          borderRadius: 16,
          cursor: "pointer",
          textAlign: "left",
          transition: "all .22s",
        }}
        onMouseEnter={(e) => {
          if (!copied) e.currentTarget.style.borderColor = T.ink;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = copied
            ? "rgba(31,138,91,.35)"
            : T.line;
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            flexShrink: 0,
            background: copied ? "rgba(31,138,91,.13)" : T.bg,
            color: copied ? "#1A7A4A" : T.ink2,
            border: copied ? "none" : `1px solid ${T.line2}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all .2s",
          }}
        >
          {copied ? <CheckIcon size={17} /> : <LinkIcon size={18} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 600,
              color: copied ? "#1A7A4A" : T.ink,
              letterSpacing: "-.01em",
            }}
          >
            {copied ? "Скопировано!" : "Копировать ссылку"}
          </span>
        </span>
        {!copied && (
          <span style={{ fontSize: 16, color: T.ink3 }}>→</span>
        )}
      </button>

      {/* Share via native */}
      {hasNativeShare && (
        <button
          onClick={handleNativeShare}
          style={{ ...optBase, marginTop: 7, background: "transparent" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = T.ink)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = T.line)
          }
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: T.bg,
              color: T.ink2,
              border: `1px solid ${T.line2}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShareMoreIcon size={19} />
          </span>
          <span style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: T.ink,
                letterSpacing: "-.01em",
              }}
            >
              Поделиться через…
            </div>
            <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>
              Другие приложения
            </div>
          </span>
          <span style={{ color: T.ink3, fontSize: 16 }}>→</span>
        </button>
      )}
    </div>
  );
}

/* ─── Modal wrapper ─── */
export function ShareModal({
  open,
  onOpenChange,
  url,
  title,
  subtitle,
  entityNoun,
}: ShareModalProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const innerContent = (
    <ShareContent
      url={url}
      title={title}
      subtitle={subtitle}
      entityNoun={entityNoun}
      onClose={() => onOpenChange(false)}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden"
          style={{
            maxWidth: 430,
            borderRadius: 24,
            border: `1px solid ${T.line}`,
            background: "#FFFFFF",
            boxShadow:
              "0 2px 0 rgba(255,255,255,.5) inset, 0 40px 80px -20px rgba(20,18,16,.22)",
          }}
        >
          <DialogTitle className="sr-only">Поделиться</DialogTitle>
          {innerContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full p-0 gap-0"
        style={{
          borderRadius: "22px 22px 0 0",
          background: "#FFFFFF",
          border: "none",
          boxShadow: "0 -8px 40px rgba(20,18,16,.14)",
        }}
      >
        <SheetTitle className="sr-only">Поделиться</SheetTitle>
        {/* Drag handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "14px 0 0",
          }}
        >
          <span
            style={{
              width: 36,
              height: 4,
              borderRadius: 99,
              background: T.line2,
              display: "block",
            }}
          />
        </div>
        {innerContent}
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </SheetContent>
    </Sheet>
  );
}
