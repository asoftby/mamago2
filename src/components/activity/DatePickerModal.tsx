"use client";

/**
 * DatePickerModal — выбор даты для сохранения активности в план.
 *
 * Особенности:
 *  • Горизонтальный скроллер дат с кнопками ‹ ›
 *  • Spring-анимация появления confirmation bar
 *  • Fade числа при смене даты + pulse кнопки «Готово»
 *  • Раскрывающийся список всех дат
 *  • Mobile-first: 360–480px
 *  • Только React + inline styles + useState/useEffect
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

// ─── Типы ──────────────────────────────────────────────────────────────────────
export interface DatePickerModalProps {
  /** Название активности, показывается под заголовком */
  activityName: string;
  /** Начало диапазона дат */
  startDate: Date;
  /** Конец диапазона дат */
  endDate: Date;
  /** Пользователь подтвердил дату */
  onConfirm: (date: Date) => void;
  /** Пользователь выбрал «Сохранить в идеи» */
  onSaveAsIdea: () => void;
  /** Закрыть модалку */
  onClose: () => void;
}

// ─── Дизайн-токены ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#F5F0EA",
  card:     "#FFFFFF",
  dark:     "#1A1410",
  orange:   "#E07A4E",
  text:     "#1A1410",
  textSec:  "#9A8E84",
  border:   "#E8E0D4",
} as const;

// ─── Русская локаль ────────────────────────────────────────────────────────────
const RU_DAYS_2  = ["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"] as const;
const RU_DAYS_F  = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"] as const;
const RU_MON_3   = ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"] as const;
const RU_MON_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"] as const;
const RU_MON_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"] as const;

// ─── Хелперы ───────────────────────────────────────────────────────────────────

/** Все даты (начало дня) из диапазона включительно */
function generateDates(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const fin = new Date(end.getFullYear(),   end.getMonth(),   end.getDate());
  while (cur <= fin) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

/** "Июль 2026" или "Июль — Август 2026" если диапазон */
function monthRangeLabel(dates: Date[]): string {
  if (!dates.length) return "";
  const f = dates[0];
  const l = dates[dates.length - 1];
  if (f.getFullYear() === l.getFullYear() && f.getMonth() === l.getMonth()) {
    return `${RU_MON_NOM[f.getMonth()]} ${f.getFullYear()}`;
  }
  if (f.getFullYear() === l.getFullYear()) {
    return `${RU_MON_NOM[f.getMonth()]} — ${RU_MON_NOM[l.getMonth()]} ${l.getFullYear()}`;
  }
  return `${RU_MON_NOM[f.getMonth()]} ${f.getFullYear()} — ${RU_MON_NOM[l.getMonth()]} ${l.getFullYear()}`;
}

/** "Понедельник, 20 июля" */
function fmtFull(d: Date): string {
  return `${RU_DAYS_F[d.getDay()]}, ${d.getDate()} ${RU_MON_GEN[d.getMonth()]}`;
}

/** "20 июля" */
function fmtShort(d: Date): string {
  return `${d.getDate()} ${RU_MON_GEN[d.getMonth()]}`;
}

// ─── Иконки ────────────────────────────────────────────────────────────────────
function BookmarkIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M6 4h12v17l-6-4-6 4z" />
    </svg>
  );
}

// ─── CSS, инжектируемый один раз ──────────────────────────────────────────────
const INJECTED_CSS = `
  @keyframes dpm-bar-in {
    from { transform: translateY(24px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes dpm-pulse {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.06); }
    100% { transform: scale(1); }
  }
  .dpm-track::-webkit-scrollbar { display: none; }
  .dpm-card:hover:not(.dpm-card--sel) {
    border-color: #1A1410 !important;
    background: #fdf9f5 !important;
  }
  .dpm-arrow:hover {
    background: #1A1410 !important;
    color: #fff !important;
    border-color: #1A1410 !important;
  }
  .dpm-showmore:hover { border-color: #1A1410 !important; }
  .dpm-ideas-btn:hover {
    background: #f5f0e8 !important;
    border-color: #cec6ba !important;
  }
  .dpm-ideas-btn:hover .dpm-ideas-icon {
    background: #ebe5dc !important;
  }
  .dpm-all-chip:hover:not(.dpm-all-chip--sel) {
    border-color: #1A1410 !important;
  }
`;

// ─── Основной компонент ────────────────────────────────────────────────────────
export function DatePickerModal({
  activityName,
  startDate,
  endDate,
  onConfirm,
  onSaveAsIdea,
  onClose,
}: DatePickerModalProps) {
  // Генерируем список дат один раз
  const dates = useMemo(
    () => generateDates(startDate, endDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startDate.getTime(), endDate.getTime()],
  );

  const lastDate = dates[dates.length - 1];

  // ─── Состояние ──────────────────────────────────────────────────────────────
  /** Реально выбранная дата (для логики) */
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  /** Дата, отображаемая в плашке (обновляется с задержкой для fade) */
  const [displayDate, setDisplayDate] = useState<Date | null>(null);
  /** true → текст даты прозрачен (fade out) */
  const [dateFading, setDateFading] = useState(false);
  /** true → плашка видна (transition in) */
  const [barVisible, setBarVisible] = useState(false);
  /** Показать все даты */
  const [showAll, setShowAll] = useState(false);

  // ─── Рефы ───────────────────────────────────────────────────────────────────
  const scrollRef     = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  /** Флаг: была ли уже выбрана хоть одна дата (для различия first-select vs re-select) */
  const hadSelection  = useRef(false);

  // ─── Выбор даты ─────────────────────────────────────────────────────────────
  const handleSelect = useCallback((date: Date) => {
    if (!hadSelection.current) {
      // ── Первый выбор: плашка появляется со spring-анимацией ──────────────
      hadSelection.current = true;
      setSelectedDate(date);
      setDisplayDate(date);
      // Два rAF: первый ставит элемент в DOM, второй триггерит transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setBarVisible(true));
      });
    } else {
      // ── Повторный выбор: fade текста + pulse кнопки ───────────────────────
      setSelectedDate(date);
      setDateFading(true);

      window.setTimeout(() => {
        // 100ms fade-out → обновляем текст → 100ms fade-in
        setDisplayDate(date);
        setDateFading(false);

        // Pulse кнопки «Готово»
        const btn = confirmBtnRef.current;
        if (btn) {
          btn.style.animation = "none";
          void btn.offsetHeight; // принудительный reflow → анимация рестартует
          btn.style.animation = "dpm-pulse 200ms cubic-bezier(0.34, 1.56, 0.64, 1)";
          window.setTimeout(() => {
            if (confirmBtnRef.current) confirmBtnRef.current.style.animation = "";
          }, 200);
        }
      }, 100);
    }
  }, []);

  // ─── Кнопки скроллера ───────────────────────────────────────────────────────
  const CARD_STEP = 84; // ≈ ширина карточки (76px) + gap (8px)
  const scrollLeft  = useCallback(() => scrollRef.current?.scrollBy({ left: -CARD_STEP * 2, behavior: "smooth" }), []);
  const scrollRight = useCallback(() => scrollRef.current?.scrollBy({ left:  CARD_STEP * 2, behavior: "smooth" }), []);

  // ─── Scroll selected card into view when dates change ───────────────────────
  useEffect(() => {
    if (!selectedDate || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-date="${selectedDate.getTime()}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDate]);

  // ─── Рендер ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: C.bg,
      borderRadius: 28,
      padding: "28px 24px 28px",
      width: "100%",
      maxWidth: 480,
      position: "relative",
      boxSizing: "border-box",
      fontFamily: "'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>

      {/* ── Инжект стилей (один раз, лёгкий) ───────────────────────────── */}
      <style>{INJECTED_CSS}</style>

      {/* ════════════════════════════════════════════════════════════════════
          1. ШАПКА
      ════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 22 }}>
        {/* Кикер */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7, marginBottom: 12,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 99,
            background: C.orange, flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "1.2px",
            textTransform: "uppercase", color: C.orange,
          }}>
            Сохранить активность
          </span>
        </div>

        {/* Заголовок */}
        <h2 style={{
          margin: "0 0 8px",
          fontFamily: "var(--font-editorial)",
          fontSize: 30, fontWeight: 400,
          lineHeight: 1.1, letterSpacing: "-0.5px",
          color: C.text,
        }}>
          На какой{" "}
          <em style={{ fontStyle: "italic", color: C.orange }}>день</em>{" "}
          напомнить?
        </h2>

        {/* Название активности */}
        <p style={{
          margin: 0, fontSize: 14, color: C.textSec, lineHeight: 1.45,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {activityName}
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2. ГОРИЗОНТАЛЬНЫЙ СКРОЛЛЕР ДАТ
      ════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 12 }}>
        {/* Строка: месяц + кол-во дат */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 12,
        }}>
          <span style={{
            fontSize: 17, fontWeight: 700,
            letterSpacing: "-0.4px", color: C.text,
          }}>
            {monthRangeLabel(dates)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: "1px", textTransform: "uppercase",
            color: C.textSec,
          }}>
            {dates.length} ДАТ
          </span>
        </div>

        {/* Трек с карточками */}
        <div style={{ position: "relative" }}>

          {/* ‹ Левая стрелка */}
          <button
            className="dpm-arrow"
            onClick={scrollLeft}
            aria-label="Назад"
            style={{
              position: "absolute", left: 0, top: "50%",
              transform: "translateY(-50%)", zIndex: 3,
              width: 34, height: 34, borderRadius: 99,
              background: C.card, border: `1px solid ${C.border}`,
              color: C.text, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 19, lineHeight: 1,
              boxShadow: "0 2px 8px rgba(26,20,16,.07)",
              transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
            }}
          >‹</button>

          {/* › Правая стрелка */}
          <button
            className="dpm-arrow"
            onClick={scrollRight}
            aria-label="Вперёд"
            style={{
              position: "absolute", right: 0, top: "50%",
              transform: "translateY(-50%)", zIndex: 3,
              width: 34, height: 34, borderRadius: 99,
              background: C.card, border: `1px solid ${C.border}`,
              color: C.text, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 19, lineHeight: 1,
              boxShadow: "0 2px 8px rgba(26,20,16,.07)",
              transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
            }}
          >›</button>

          {/* Fade-маски по краям */}
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 40,
            background: `linear-gradient(90deg, ${C.bg} 35%, transparent)`,
            pointerEvents: "none", zIndex: 2,
          }} />
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 40,
            background: `linear-gradient(270deg, ${C.bg} 35%, transparent)`,
            pointerEvents: "none", zIndex: 2,
          }} />

          {/* Скроллируемый контейнер */}
          <div
            ref={scrollRef}
            className="dpm-track"
            style={{
              display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden",
              padding: "4px 42px",
              scrollbarWidth: "none",
              scrollSnapType: "x proximity",
            }}
          >
            {dates.map((date) => {
              const isSel = selectedDate ? isSameDay(date, selectedDate) : false;
              return (
                <button
                  key={date.getTime()}
                  data-date={date.getTime()}
                  className={`dpm-card${isSel ? " dpm-card--sel" : ""}`}
                  onClick={() => handleSelect(date)}
                  style={{
                    // Размеры
                    flexShrink: 0, scrollSnapAlign: "center",
                    width: 80, minHeight: 116, borderRadius: 16,
                    padding: "14px 6px 12px",
                    // Цвета — transition задан в CSS-классе
                    background:   isSel ? C.dark  : C.card,
                    border: `1.5px solid ${isSel ? C.dark : C.border}`,
                    color: isSel ? "#fff" : C.text,
                    // Layout
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 0, cursor: "pointer",
                    transition: "background 200ms ease, color 200ms ease, border-color 200ms ease",
                    position: "relative",
                  }}
                >
                  {/* День недели */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "1.2px",
                    textTransform: "uppercase", lineHeight: 1,
                    color: isSel ? "rgba(255,255,255,.5)" : C.textSec,
                    marginBottom: 5,
                  }}>
                    {RU_DAYS_2[date.getDay()]}
                  </span>

                  {/* Число — крупный */}
                  <span style={{
                    fontSize: 42, fontWeight: 800, lineHeight: 1,
                    letterSpacing: "-2px",
                    color: isSel ? "#fff" : C.text,
                  }}>
                    {date.getDate()}
                  </span>

                  {/* Месяц */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "1.2px",
                    textTransform: "uppercase", lineHeight: 1,
                    color: isSel ? "rgba(255,255,255,.45)" : C.textSec,
                    marginTop: 4,
                  }}>
                    {RU_MON_3[date.getMonth()]}
                  </span>

                  {/* 3 оранжевых точки — индикатор слотов */}
                  <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{
                        width: 5, height: 5, borderRadius: 99,
                        background: C.orange,
                        opacity: isSel ? 1 : 0.55,
                        transition: "opacity 200ms ease",
                      }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          3. РАСКРЫВАЛКА «Показать все N дат»
      ════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 0 }}>
        <button
          className="dpm-showmore"
          onClick={() => setShowAll((v) => !v)}
          style={{
            width: "100%", padding: "12px 16px",
            background: "transparent",
            border: `1px solid ${showAll ? C.dark : C.border}`,
            borderRadius: 14, display: "flex",
            alignItems: "center", justifyContent: "space-between",
            color: C.text, fontSize: 14,
            cursor: "pointer", fontFamily: "inherit",
            transition: "border-color 150ms ease",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 99, flexShrink: 0,
              border: `1.5px solid ${C.border}`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: C.textSec, lineHeight: 1,
              transition: "border-color 150ms ease",
            }}>
              {showAll ? "−" : "+"}
            </span>
            <span>{showAll ? "Скрыть" : `Показать все ${dates.length} дат`}</span>
          </span>
          {!showAll && lastDate && (
            <span style={{ fontSize: 12, color: C.textSec, letterSpacing: "0.2px", flexShrink: 0 }}>
              до {fmtShort(lastDate)} →
            </span>
          )}
        </button>

        {/* Сетка всех дат (accordion) */}
        {showAll && (
          <div style={{
            marginTop: 10,
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: "16px 14px",
            display: "flex", flexWrap: "wrap", gap: 6,
            maxHeight: 272, overflowY: "auto",
          }}>
            {dates.map((date) => {
              const isSel = selectedDate ? isSameDay(date, selectedDate) : false;
              return (
                <button
                  key={date.getTime()}
                  className={`dpm-all-chip${isSel ? " dpm-all-chip--sel" : ""}`}
                  onClick={() => { handleSelect(date); setShowAll(false); }}
                  style={{
                    padding: "8px 11px", borderRadius: 12,
                    background:   isSel ? C.dark : C.bg,
                    border: `1.5px solid ${isSel ? C.dark : C.border}`,
                    color: isSel ? "#fff" : C.text,
                    display: "flex", flexDirection: "column",
                    alignItems: "flex-start", gap: 1, minWidth: 58,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 150ms ease",
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: isSel ? "rgba(255,255,255,.5)" : C.textSec,
                  }}>
                    {RU_DAYS_2[date.getDay()]}
                  </span>
                  <span style={{
                    fontSize: 22, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.5px",
                    color: isSel ? "#fff" : C.text,
                  }}>
                    {date.getDate()}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: isSel ? "rgba(255,255,255,.45)" : C.textSec,
                  }}>
                    {RU_MON_3[date.getMonth()]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          4. ПЛАШКА ПОДТВЕРЖДЕНИЯ
          Появляется когда displayDate !== null.
          Spring-эффект через CSS transition.
      ════════════════════════════════════════════════════════════════════ */}
      {displayDate && (
        <div style={{
          marginTop: 16,
          background: C.dark, borderRadius: 18,
          padding: "18px 16px 18px 20px",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 16,
          // Spring-появление: сначала invisible+shifted, после rAF → visible+in-place
          opacity:   barVisible ? 1 : 0,
          transform: barVisible ? "translateY(0)" : "translateY(24px)",
          transition: barVisible
            ? [
                "opacity 280ms ease",
                "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              ].join(", ")
            : "none",
          willChange: "transform, opacity",
        }}>

          {/* Левая часть: "● ВЫБРАНО" + дата */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              marginBottom: 6,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: 99,
                background: "rgba(255,255,255,.35)", flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: "1.2px", textTransform: "uppercase",
                color: "rgba(255,255,255,.45)",
              }}>
                Выбрано
              </span>
            </div>

            {/* Дата с fade при смене */}
            <div style={{
              fontSize: 18, fontWeight: 700, color: "#fff",
              lineHeight: 1.2,
              opacity: dateFading ? 0 : 1,
              transition: "opacity 100ms ease",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {fmtFull(displayDate)}
            </div>
          </div>

          {/* Кнопка «Готово →» с pulse-анимацией */}
          <button
            ref={confirmBtnRef}
            onClick={() => selectedDate && onConfirm(selectedDate)}
            style={{
              height: 48, padding: "0 20px", borderRadius: 999,
              background: C.orange, color: "#fff", border: 0,
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              flexShrink: 0, whiteSpace: "nowrap",
              fontFamily: "inherit", letterSpacing: "-0.2px",
              // animation управляется через ref
            }}
          >
            Сохранить
            <span style={{ fontSize: 17, lineHeight: 1 }}>→</span>
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          5. РАЗДЕЛИТЕЛЬ «или без даты»
      ════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        margin: "20px 0 16px",
      }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{
          fontFamily: "var(--font-editorial)",
          fontStyle: "italic", fontSize: 15, color: C.textSec,
          whiteSpace: "nowrap",
        }}>
          или без даты
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          6. КАРТОЧКА «Сохранить в идеи»
      ════════════════════════════════════════════════════════════════════ */}
      <button
        className="dpm-ideas-btn"
        onClick={onSaveAsIdea}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px", borderRadius: 18,
          background: C.card,
          border: `1.5px solid ${C.border}`,
          textAlign: "left", cursor: "pointer",
          fontFamily: "inherit",
          transition: "background 150ms ease, border-color 150ms ease",
          boxSizing: "border-box",
        }}
      >
        {/* Иконка в кружке */}
        <div
          className="dpm-ideas-icon"
          style={{
            width: 48, height: 48, borderRadius: 99, flexShrink: 0,
            background: C.bg, border: `1.5px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.textSec,
            transition: "background 150ms ease",
          }}
        >
          <BookmarkIcon size={20} color={C.textSec} />
        </div>

        {/* Текст */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600,
            color: C.text, marginBottom: 3, lineHeight: 1.3,
          }}>
            Сохранить в идеи
          </div>
          <div style={{
            fontSize: 13, color: C.textSec, lineHeight: 1.4,
          }}>
            Вернуться к этому позже — без конкретного дня
          </div>
        </div>

        {/* Стрелка */}
        <span style={{
          fontSize: 20, color: C.textSec, flexShrink: 0,
          lineHeight: 1, marginLeft: 4,
        }}>→</span>
      </button>
    </div>
  );
}
