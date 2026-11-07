import * as React from "react";
import { C } from "./tokens";
import { fmtDateChip, RU_MONTHS_FULL } from "./dateFormat";

// ─── Dark confirmation bar ────────────────────────────────────────────────────
export interface SaveConfirmBarProps {
  iso: string;
  time?: string | null;
  onConfirm: () => void;
  label?: string;
  /** Блокирует действие (например, не выбран адресат). Решает вызывающий код. */
  disabled?: boolean;
}

export function SaveConfirmBar({ iso, time, onConfirm, label = "Сохранить", disabled = false }: SaveConfirmBarProps) {
  const chip = fmtDateChip(iso);
  const DOW_FULL: Record<string, string> = {
    вс: "Воскресенье", пн: "Понедельник", вт: "Вторник",
    ср: "Среда", чт: "Четверг", пт: "Пятница", сб: "Суббота",
  };
  return (
    <div style={{
      marginTop: 14, padding: "14px 16px",
      background: C.peach, color: C.ink, borderRadius: 14,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: ".1em", color: C.ink3, marginBottom: 3 }}>● выбрано</div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" }}>
          {DOW_FULL[chip.dow] ?? chip.dow},{" "}
          <span>{chip.day}</span>{" "}
          {RU_MONTHS_FULL[chip.monthIdx]}
          {time && (
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 13, fontWeight: 500, color: C.ink2, marginLeft: 6 }}>
              · {time}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onConfirm}
        disabled={disabled}
        title={disabled ? "Выберите, для кого сохраняем" : undefined}
        aria-label="Добавить в план"
        style={{
          height: 46, padding: "0 20px", borderRadius: 999,
          background: disabled ? "#DBD7D3" : C.accent, color: disabled ? C.ink3 : "#fff",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0, cursor: disabled ? "not-allowed" : "pointer", border: 0,
          fontSize: 14, fontWeight: 600, letterSpacing: "-.01em",
          fontFamily: "var(--font-sans, ui-sans-serif)",
          transition: "transform .18s",
          whiteSpace: "nowrap",
        }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(.94)"; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
      >
        {label}
      </button>
    </div>
  );
}
