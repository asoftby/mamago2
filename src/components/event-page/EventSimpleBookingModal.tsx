"use client";

import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import type { EventSimpleBookingData, EventBookingSlot } from "@/lib/event/eventPageTypes";

/* ─────────────── validation ─────────────── */
const schema = z.object({
  customerName: z.string().min(2, "Введите имя (минимум 2 символа)").max(120),
  customerPhone: z
    .string()
    .min(7, "Введите телефон")
    .max(30)
    .regex(/^\+?[\d\s\-().]{7,30}$/, "Некорректный формат"),
  comment: z.string().max(500),
});
type FormValues = z.infer<typeof schema>;
type Phase = "form" | "submitting" | "success" | "error";

/* ─────────────── helpers ─────────────── */
const RU_MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const RU_DAYS_SHORT   = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

type DateGroup = {
  isoDate: string;
  dow: string;
  d: string;
  m: string;
  slots: EventBookingSlot[];
};

function groupSlotsByDate(slots: EventBookingSlot[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  for (const slot of slots) {
    if (!map.has(slot.isoDate)) {
      const dt = new Date(slot.isoDate + "T12:00:00");
      map.set(slot.isoDate, {
        isoDate: slot.isoDate,
        dow: RU_DAYS_SHORT[dt.getDay()] ?? "",
        d: String(dt.getDate()),
        m: RU_MONTHS_SHORT[dt.getMonth()] ?? "",
        slots: [],
      });
    }
    map.get(slot.isoDate)!.slots.push(slot);
  }
  return Array.from(map.values());
}

function slotTimeLabel(slot: EventBookingSlot) {
  return slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime;
}

/* ─────────────── sub-components ─────────────── */
function XBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Закрыть"
      style={{
        width: 36, height: 36, borderRadius: 99,
        border: "1px solid rgba(20,18,16,.18)",
        color: "#3A332B",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", fontSize: 13,
        transition: "all .2s", cursor: "pointer", flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#141210"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#141210"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#3A332B"; e.currentTarget.style.borderColor = "rgba(20,18,16,.18)"; }}
    >✕</button>
  );
}

/* ─────────────── shared field atoms ─────────────── */
const fieldInputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", borderRadius: 14,
  background: "#FAF7F1", border: "1.5px solid rgba(20,18,16,.10)",
  fontSize: 15, color: "#141210", outline: "none",
  transition: "border-color .18s, box-shadow .18s",
  fontFamily: "inherit",
};
const focusStyle = (el: HTMLElement) => { el.style.borderColor = "#E86A3A"; el.style.boxShadow = "0 0 0 3px rgba(232,106,58,.12)"; };
const blurStyle  = (el: HTMLElement) => { el.style.borderColor = "rgba(20,18,16,.10)"; el.style.boxShadow = "none"; };

const FieldInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input ref={ref} style={fieldInputStyle}
      onFocus={e => focusStyle(e.target)} onBlur={e => blurStyle(e.target)}
      {...props} />
  )
);
FieldInput.displayName = "FieldInput";

const FieldTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => (
    <textarea ref={ref} style={{ ...fieldInputStyle, resize: "none" }}
      onFocus={e => focusStyle(e.target)} onBlur={e => blurStyle(e.target)}
      {...props} />
  )
);
FieldTextarea.displayName = "FieldTextarea";

function FieldWrap({ label, labelSuffix, error, children }: { label: string; labelSuffix?: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <label style={{ fontSize: 13, color: "#3A332B", fontWeight: 500 }}>
        {label}{labelSuffix && <span style={{ fontSize: 12, color: "rgba(20,18,16,.55)", fontWeight: 400, marginLeft: 4 }}>{labelSuffix}</span>}
      </label>
      {children}
      {error && <p style={{ margin: 0, fontSize: 12, color: "#C24E22" }}>{error}</p>}
    </div>
  );
}

/* ─────────────── main component ─────────────── */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  eventCategory?: string;
  priceLabel?: string;
  booking: EventSimpleBookingData;
};

export function EventSimpleBookingModal({
  open, onOpenChange,
  eventTitle, eventCategory, priceLabel,
  booking,
}: Props) {
  const slots = booking.slots ?? [];
  const dateGroups = useMemo(() => groupSlotsByDate(slots), [slots]);

  const [phase, setPhase]       = useState<Phase>("form");
  const [apiError, setApiError] = useState<string | null>(null);
  const [dateId, setDateId]     = useState<string>(dateGroups[0]?.isoDate ?? "");
  const [timeId, setTimeId]     = useState<string>(dateGroups[0]?.slots[0]?.id ?? "");

  const selectedDate = dateGroups.find(d => d.isoDate === dateId) ?? dateGroups[0];
  const selectedSlot = slots.find(s => s.id === timeId);

  // В режиме time-slots нужен выбранный слот; в simple-booking слотов нет → сразу valid
  const valid = slots.length > 0 ? !!timeId : true;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customerName: "", customerPhone: "", comment: "" },
  });

  async function onSubmit(values: FormValues) {
    if (!valid) return;
    setPhase("submitting");
    setApiError(null);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          publicationType: "EVENT",
          publicationId: booking.activityId,
          requestedDate: selectedSlot?.isoDate ?? booking.date,
          requestedTime: selectedSlot?.startTime ?? booking.time,
          customerName: values.customerName.trim(),
          customerPhone: values.customerPhone.trim(),
          customerComment: values.comment.trim() || undefined,
          adultsCount: 1, childrenCount: 0,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setApiError(json.error ?? "Не удалось отправить заявку."); setPhase("error"); return; }
      setPhase("success");
    } catch {
      setApiError("Ошибка соединения. Попробуйте ещё раз.");
      setPhase("error");
    }
  }

  function handleClose(val: boolean) {
    if (!val) {
      reset(); setPhase("form"); setApiError(null);
      setDateId(dateGroups[0]?.isoDate ?? "");
      setTimeId(dateGroups[0]?.slots[0]?.id ?? "");
    }
    onOpenChange(val);
  }

  /* ── success screen ── */
  if (phase === "success") {
    return (
      <ResponsiveOverlay open={open} onOpenChange={handleClose} a11yTitle="Заявка принята" variant="chromeless">
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 20, padding: "44px 32px", textAlign: "center",
          background: "#F6F2EA", borderRadius: 24, position: "relative",
        }}>
          <button
            type="button" onClick={() => handleClose(false)}
            style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 99, border: "1px solid rgba(20,18,16,.18)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}
          >✕</button>

          <div style={{ width: 64, height: 64, borderRadius: 99, background: "rgba(31,138,91,.12)", color: "#1F8A5B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, animation: "sbPop .4s cubic-bezier(.2,.7,.2,1) both" }}>
            ✓
          </div>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 32, lineHeight: 1, letterSpacing: "-.02em", color: "#141210" }}>
              Вы <em style={{ fontStyle: "italic", color: "#C24E22" }}>записаны</em>!
            </h2>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "rgba(20,18,16,.55)", lineHeight: 1.55, maxWidth: 300 }}>
              Организатор свяжется с вами для подтверждения.
            </p>
          </div>

          {selectedSlot && (
            <div style={{ padding: "14px 18px", borderRadius: 14, background: "#FAF7F1", border: "1px solid rgba(20,18,16,.10)", textAlign: "left", width: "100%" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(20,18,16,.55)", marginBottom: 8 }}>● детали</div>
              <div style={{ fontSize: 14, color: "rgba(20,18,16,.70)", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, color: "#141210" }}>{eventTitle}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(20,18,16,.55)" }}>
                  {selectedDate?.dow}, {selectedDate?.d} {selectedDate?.m} · {slotTimeLabel(selectedSlot)}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={() => handleClose(false)}
            style={{
              height: 46, padding: "0 28px", borderRadius: 99,
              background: "transparent", border: "1px solid rgba(20,18,16,.18)",
              color: "#141210", fontSize: 14, fontWeight: 500, cursor: "pointer",
              transition: "border-color .15s",
            }}
          >
            Закрыть
          </button>

          <style>{`@keyframes sbPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}`}</style>
        </div>
      </ResponsiveOverlay>
    );
  }

  /* ── main form ── */
  return (
    <ResponsiveOverlay open={open} onOpenChange={handleClose} a11yTitle="Записаться на событие" variant="chromeless" heightMode="tall">
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F6F2EA", borderRadius: 24, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 22px 18px",
          borderBottom: "1px solid rgba(20,18,16,.10)",
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 28, lineHeight: 1, letterSpacing: "-.02em", color: "#141210" }}>
            Записаться <em style={{ fontStyle: "italic", color: "#C24E22" }}>на событие</em>
          </h2>
          <XBtn onClick={() => handleClose(false)} />
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          <form id="sb-form" onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Event chip */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px 10px 10px",
              background: "#FAF7F1", border: "1px solid rgba(20,18,16,.10)",
              borderRadius: 14,
            }}>
              <span style={{
                width: 34, height: 34, borderRadius: 10,
                background: "#FFE8DC", color: "#C24E22",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>✱</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {eventCategory && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(20,18,16,.55)", marginBottom: 2 }}>
                    {eventCategory}
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, color: "#141210", letterSpacing: "-.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {eventTitle}
                </div>
              </div>
              {priceLabel && (
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-.015em", color: "#141210", flexShrink: 0 }}>
                  {renderCurrencyText(normalizeUiCurrencyText(priceLabel))}
                </span>
              )}
            </div>

            {/* Date + time selector */}
            {dateGroups.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Field label */}
                <div style={{ fontSize: 13, color: "#3A332B", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(20,18,16,.55)" }}>
                    <rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>
                  </svg>
                  Выберите дату
                </div>

                {/* Date strip */}
                <div style={{ display: "flex", gap: 7, overflowX: "auto", scrollSnapType: "x proximity", padding: "2px 2px 2px", scrollbarWidth: "none" }}>
                  {dateGroups.map(dg => {
                    const isSel = dg.isoDate === dateId;
                    return (
                      <button
                        key={dg.isoDate}
                        type="button"
                        onClick={() => { setDateId(dg.isoDate); setTimeId(dg.slots[0]?.id ?? ""); }}
                        style={{
                          flex: "0 0 auto", scrollSnapAlign: "center",
                          width: 70, padding: "10px 6px",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                          background: isSel ? "#141210" : "#FAF7F1",
                          color: isSel ? "#FAF7F1" : "#141210",
                          border: `1px solid ${isSel ? "#141210" : "rgba(20,18,16,.10)"}`,
                          borderRadius: 14, cursor: "pointer",
                          transition: "all .15s",
                        }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = "#141210"; }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = "rgba(20,18,16,.10)"; }}
                      >
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: isSel ? "rgba(250,247,241,.55)" : "rgba(20,18,16,.55)" }}>
                          {dg.dow}
                        </span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1, letterSpacing: "-.02em" }}>
                          {dg.d}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".06em", color: isSel ? "rgba(250,247,241,.5)" : "rgba(20,18,16,.55)" }}>
                          {dg.m}
                        </span>
                        {/* dots = number of slots */}
                        <span style={{ display: "flex", gap: 3, height: 5, alignItems: "center", marginTop: 1 }}>
                          {dg.slots.slice(0, 3).map((_, i) => (
                            <span key={i} style={{ width: 3, height: 3, borderRadius: 99, background: isSel ? "rgba(250,247,241,.5)" : "#E86A3A" }} />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Time chips */}
                {selectedDate && selectedDate.slots.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 13, color: "#3A332B", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(20,18,16,.55)" }}>
                        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                      </svg>
                      Время
                    </div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {selectedDate.slots.map(slot => {
                        const isSel = slot.id === timeId;
                        const isLow = slot.capacity != null && slot.capacity <= 5;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setTimeId(slot.id)}
                            style={{
                              height: 38, padding: "0 14px", borderRadius: 99,
                              background: isSel ? "#E86A3A" : "#FAF7F1",
                              color: isSel ? "#fff" : "#141210",
                              border: `1px solid ${isSel ? "transparent" : "rgba(20,18,16,.10)"}`,
                              fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
                              letterSpacing: ".02em", cursor: "pointer", transition: "all .15s",
                              display: "inline-flex", alignItems: "center", gap: 8,
                            }}
                            onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = "#141210"; }}
                            onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = "rgba(20,18,16,.10)"; }}
                          >
                            {slotTimeLabel(slot)}
                            {isLow && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: isSel ? "rgba(255,255,255,.7)" : "#C24E22", letterSpacing: ".06em", textTransform: "uppercase" }}>
                                ● {slot.capacity} мест
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Имя */}
            <FieldWrap label="Имя" error={errors.customerName?.message}>
              <FieldInput id="sb-name" placeholder="Как вас зовут" {...register("customerName")} />
            </FieldWrap>

            {/* Телефон */}
            <FieldWrap label="Телефон" error={errors.customerPhone?.message}>
              <FieldInput id="sb-phone" type="tel" placeholder="+375 XX XXX-XX-XX" {...register("customerPhone")} />
            </FieldWrap>

            {/* Комментарий */}
            <FieldWrap label="Комментарий" labelSuffix="(необязательно)">
              <FieldTextarea id="sb-comment" placeholder="Количество мест, вопросы..." rows={3} {...register("comment")} />
            </FieldWrap>

            {phase === "error" && apiError && (
              <p style={{ margin: 0, padding: "12px 16px", borderRadius: 12, background: "#FEF2F2", fontSize: 13, color: "#B91C1C", lineHeight: 1.5 }}>
                {apiError}
              </p>
            )}

          </form>
        </div>

        {/* Footer CTA */}
        <div style={{ padding: "14px 22px 20px", flexShrink: 0, borderTop: "1px solid rgba(20,18,16,.08)" }}>
          <button
            form="sb-form"
            type="submit"
            disabled={phase === "submitting" || !valid}
            style={{
              width: "100%", height: 56, borderRadius: 99,
              background: phase === "submitting" || !valid
                ? "rgba(20,18,16,.18)"
                : "linear-gradient(180deg, #FBA77B, #E86A3A)",
              color: phase === "submitting" || !valid ? "rgba(20,18,16,.45)" : "#fff",
              fontSize: 15, fontWeight: 600, letterSpacing: ".005em",
              border: 0, cursor: phase === "submitting" || !valid ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: phase === "submitting" || !valid ? "none" : "0 18px 40px -12px rgba(232,106,58,.55)",
              transition: "box-shadow .2s, filter .2s",
              fontFamily: "inherit",
            }}
          >
            {phase === "submitting"
              ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              : <>
                  Записаться
                  {selectedSlot && <span style={{ opacity: .85 }}>→ {slotTimeLabel(selectedSlot)}</span>}
                </>
            }
          </button>
          <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12, color: "rgba(20,18,16,.45)" }}>
            Организатор свяжется для подтверждения
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        [id="sb-name"]::placeholder,
        [id="sb-phone"]::placeholder,
        [id="sb-comment"]::placeholder { color: rgba(20,18,16,.40); }
      `}</style>
    </ResponsiveOverlay>
  );
}
