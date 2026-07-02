"use client";

import { useState } from "react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";

const REASONS: { value: "SPAM" | "ABUSE" | "SCAM" | "OTHER"; label: string }[] = [
  { value: "SPAM", label: "Спам" },
  { value: "ABUSE", label: "Оскорбления" },
  { value: "SCAM", label: "Мошенничество" },
  { value: "OTHER", label: "Другое" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
};

export function DirectComplaintModal({ open, onOpenChange, threadId }: Props) {
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"] | null>(null);
  const [comment, setComment] = useState("");
  const [phase, setPhase] = useState<"form" | "submitting" | "sent" | "error">("form");

  function handleClose(val: boolean) {
    if (!val) {
      setReason(null);
      setComment("");
      setPhase("form");
    }
    onOpenChange(val);
  }

  async function submit() {
    if (!reason) return;
    setPhase("submitting");
    try {
      const res = await fetch(`/api/direct/${threadId}/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        setPhase("error");
        return;
      }
      setPhase("sent");
    } catch {
      setPhase("error");
    }
  }

  return (
    <ResponsiveOverlay open={open} onOpenChange={handleClose} a11yTitle="Пожаловаться" variant="chromeless">
      <div style={{ background: "#F6F2EA", borderRadius: 24, padding: "24px 24px 22px", maxWidth: 420 }}>
        {phase === "sent" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: 99, background: "rgba(31,138,91,.12)", color: "#1F8A5B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 16px" }}>✓</div>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, color: "#141210" }}>Жалоба отправлена</h3>
            <p style={{ margin: "8px 0 20px", fontSize: 13, color: "rgba(20,18,16,.55)" }}>Модератор рассмотрит обращение.</p>
            <button
              onClick={() => handleClose(false)}
              style={{ height: 44, padding: "0 24px", borderRadius: 99, background: "transparent", border: "1px solid rgba(20,18,16,.18)", color: "#141210", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontSize: 24, color: "#141210" }}>
              Пожаловаться на диалог
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  style={{
                    height: 46, padding: "0 16px", borderRadius: 14, textAlign: "left",
                    border: `1.5px solid ${reason === r.value ? "#E86A3A" : "rgba(20,18,16,.10)"}`,
                    background: reason === r.value ? "#FFE8DC" : "#FAF7F1",
                    color: reason === r.value ? "#C24E22" : "#141210",
                    fontSize: 14, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий (необязательно)"
              rows={3}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 14,
                background: "#FAF7F1", border: "1.5px solid rgba(20,18,16,.10)",
                fontSize: 14, color: "#141210", outline: "none", resize: "none", fontFamily: "inherit",
              }}
            />
            {phase === "error" && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#B91C1C" }}>Не удалось отправить жалобу. Попробуйте ещё раз.</p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => handleClose(false)}
                style={{ flex: 1, height: 46, borderRadius: 99, background: "transparent", border: "1px solid rgba(20,18,16,.18)", color: "#141210", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!reason || phase === "submitting"}
                style={{
                  flex: 1, height: 46, borderRadius: 99, border: 0,
                  background: !reason || phase === "submitting" ? "rgba(20,18,16,.18)" : "#E86A3A",
                  color: !reason || phase === "submitting" ? "rgba(20,18,16,.45)" : "#fff",
                  fontSize: 14, fontWeight: 600, cursor: !reason || phase === "submitting" ? "default" : "pointer",
                }}
              >
                Отправить
              </button>
            </div>
          </>
        )}
      </div>
    </ResponsiveOverlay>
  );
}
