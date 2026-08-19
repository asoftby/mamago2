"use client";

import { Phone } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import type { NormalizedPhone } from "@/lib/phones/normalizePhones";

/* ─── Design tokens (mirroring ShareModal) ─── */
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

export type CallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phones: NormalizedPhone[];
  subtitle?: string;
};

function CallContent({
  phones,
  subtitle,
  onClose,
}: Omit<CallModalProps, "open" | "onOpenChange"> & { onClose: () => void }) {
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
        Позво&shy;нить{" "}
        <span
          style={{
            fontFamily: "var(--font-editorial)",
            fontStyle: "italic",
            fontWeight: 400,
            color: T.accentDeep,
          }}
        >
          сюда
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
        {subtitle ?? "Выберите номер для звонка"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {phones.map((phone, index) => (
          <a
            key={`${phone.href}-${index}`}
            href={phone.href}
            onClick={onClose}
            style={{ ...optBase, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.ink)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.line)}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: T.bg,
                color: T.accentDeep,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Phone size={19} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.ink2,
                  letterSpacing: ".01em",
                }}
              >
                {phone.label}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 2,
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.ink,
                  letterSpacing: "-.01em",
                }}
              >
                {formatPhoneForDisplay(phone.value)}
              </span>
            </span>
            <span style={{ color: T.ink3, fontSize: 16 }}>→</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function CallModal({ open, onOpenChange, phones, subtitle }: CallModalProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  if (phones.length === 0) return null;

  const innerContent = (
    <CallContent phones={phones} subtitle={subtitle} onClose={() => onOpenChange(false)} />
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
          <DialogTitle className="sr-only">Позвонить</DialogTitle>
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
        <SheetTitle className="sr-only">Позвонить</SheetTitle>
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
