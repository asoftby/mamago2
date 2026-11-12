"use client";

import * as React from "react";
import { C } from "./tokens";
import { fmtDateChip, formatSessionDotsLabel } from "./dateFormat";

// ─── Date Slider (Variant B) ──────────────────────────────────────────────────
export interface DateSliderProps {
  options: string[];  // YYYY-MM-DD sorted upcoming
  selISO: string | null;
  onSelect: (iso: string) => void;
  sessionCountsByDate?: Record<string, number>;
}

export function DateSlider({ options, selISO, onSelect, sessionCountsByDate }: DateSliderProps) {
  const sliderRef = React.useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) => {
    sliderRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  // Scroll selected into view
  React.useEffect(() => {
    if (!selISO || !sliderRef.current) return;
    const el = sliderRef.current.querySelector<HTMLElement>(`[data-iso="${selISO}"]`);
    if (!el) return;
    const c = sliderRef.current;
    const er = el.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    if (er.left < cr.left + 40 || er.right > cr.right - 40) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selISO]);

  return (
    <div className="w-full min-w-0 max-w-full" style={{ position: "relative", marginBottom: 2 }}>
      {/* Arrows */}
      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          onClick={() => scrollBy(side === "left" ? -1 : 1)}
          aria-label={side === "left" ? "Назад" : "Вперёд"}
          style={{
            position: "absolute", [side]: -2, top: "50%", transform: "translateY(-50%)", zIndex: 2,
            width: 32, height: 32, borderRadius: 99,
            background: C.paper, border: `1px solid ${C.line2}`,
            color: C.ink, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 10px rgba(20,18,16,.06)",
            padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            {side === "left"
              ? <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            }
          </svg>
        </button>
      ))}

      {/* Fade edges */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 36, background: `linear-gradient(90deg, ${C.bg}, transparent)`, pointerEvents: "none", zIndex: 1 }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 36, background: `linear-gradient(270deg, ${C.bg}, transparent)`, pointerEvents: "none", zIndex: 1 }} />

      {/* Track */}
      <div
        ref={sliderRef}
        style={{
          display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden",
          width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
          padding: "4px 20px", scrollSnapType: "x proximity", scrollbarWidth: "none",
        }}
      >
        <style>{`.stp-slider::-webkit-scrollbar{display:none}`}</style>
        {options.map((iso) => {
          const chip = fmtDateChip(iso);
          const isSel = iso === selISO;
          const sessionsCount = sessionCountsByDate?.[iso] ?? 0;
          const dotsCount = Math.min(sessionsCount, 3);
          const dotsLabel = sessionsCount > 0 ? formatSessionDotsLabel(sessionsCount) : null;
          return (
            <button
              key={iso}
              data-iso={iso}
              onClick={() => onSelect(iso)}
              style={{
                flexShrink: 0, scrollSnapAlign: "center",
                width: 76, padding: "10px 8px 10px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: isSel ? C.peach : C.paper,
                color: C.ink,
                border: `1px solid ${isSel ? C.peachLine : C.line}`,
                borderRadius: 14, cursor: "pointer",
                transition: "all .15s", position: "relative",
                fontFamily: "var(--font-sans)",
              }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.borderColor = C.ink; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.borderColor = C.line; }}
            >
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3 }}>{chip.dow}</span>
              <span style={{ fontFamily: "var(--font-pt-serif), Georgia, serif", fontSize: 28, fontWeight: 400, lineHeight: 1, letterSpacing: "-.02em" }}>{chip.day}</span>
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 9, letterSpacing: ".08em", color: C.ink3 }}>{chip.month}</span>
              {dotsCount > 0 ? (
                <span
                  aria-label={dotsLabel ?? undefined}
                  title={dotsLabel ?? undefined}
                  style={{ display: "flex", gap: 3, minHeight: 5, alignItems: "center", marginTop: 1 }}
                >
                  {Array.from({ length: dotsCount }, (_, di) => (
                    <span key={di} style={{ width: 4, height: 4, borderRadius: 99, background: C.accent }} />
                  ))}
                </span>
              ) : (
                <span aria-hidden="true" style={{ minHeight: 5, marginTop: 1 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
