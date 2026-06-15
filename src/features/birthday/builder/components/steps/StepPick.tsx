"use client";

import { BelarusianRubleIcon } from "@/components/icons/BelarusianRubleIcon";
import { useState } from "react";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";

// ─── Mock catalog ───────────────────────────────────────────────────────────
// Used when no real offers are loaded. Mirrors the design prototype catalog.

type ToneKey = "warm" | "sun" | "soft" | "mint";

const TONES: Record<ToneKey, string> = {
  warm: "linear-gradient(160deg, #F2C8A7, #E89460)",
  sun:  "linear-gradient(160deg, #F6D567, #E8B935)",
  soft: "linear-gradient(160deg, #E6DBC8, #C9BCA0)",
  mint: "linear-gradient(160deg, #CDE3D6, #9CC1AC)",
};

interface MockOffer {
  id: string;
  title: string;
  meta: string;
  price: number;
  tone: ToneKey;
  rating: string;
  tag: string;
  allIn?: boolean;
  fit?: boolean;
  includes?: string[];
  desc: string;
  details: [string, string][];
  bundled?: { key: string; cat: string; name: string; meta: string; optional: boolean; refund: number }[];
}

type CatKey = "venue" | "animator" | "food" | "decor";

const CAT_LABEL: Record<string, string> = { venue: "Площадка", animator: "Аниматор", food: "Торт и еда", decor: "Декор" };
const CAT_ICON: Record<string, string> = { venue: "🎪", animator: "✨", food: "🍰", decor: "🎈" };

const CATALOG: Record<CatKey, MockOffer[]> = {
  venue: [
    {
      id: "v1", title: "Лофт «Облака» · «Всё включено»", meta: "до 20 детей · 3 часа", price: 480,
      tone: "warm", rating: "4.9", tag: "площадка", allIn: true,
      includes: ["animator", "food", "decor"],
      bundled: [
        { key: "animator", cat: "animator", name: "Шоу мыльных пузырей", meta: "≈30 мин · 1 актёр", optional: true, refund: 120 },
        { key: "food", cat: "food", name: "Торт классический 2 кг", meta: "крем без красителей", optional: true, refund: 0 },
        { key: "decor", cat: "decor", name: "Шары + фотозона", meta: "монтаж включён", optional: false, refund: 0 },
      ],
      desc: "Просторный светлый лофт под ключ: банкетная зона, игровая, гардероб. В пакет уже входят аниматор на 1 час, торт 2 кг и базовое оформление шарами.",
      details: [["Площадь", "85 м² · 2 зоны"], ["Аниматор", "1 час, тема на выбор"], ["Торт", "2 кг, крем без красителей"], ["Декор", "шары + фотозона"], ["Время", "3 часа аренды"]],
    },
    {
      id: "v2", title: "Игровая «Тропинка» в ТЦ", meta: "мягкая зона · аренда", price: 200,
      tone: "mint", rating: "4.8", tag: "площадка",
      includes: ["decor"],
      desc: "Безопасная мягкая игровая: многоуровневый лабиринт, бассейн с кубиками, зона для малышей.",
      details: [["Вместимость", "до 25 детей"], ["Декор", "шары на входе включены"], ["Время", "2 часа + 30 мин"]],
    },
    {
      id: "v3", title: "Антикафе «Тайм» · отдельная комната", meta: "до 15 детей · 2 часа", price: 150,
      tone: "soft", rating: "4.7", tag: "площадка",
      desc: "Уютная отдельная комната в антикафе: настолки, приставки, чайная станция.",
      details: [["Вместимость", "до 15 детей"], ["Входит", "чай, вода, настолки"], ["Время", "2 часа"]],
    },
  ],
  animator: [
    {
      id: "a1", title: "Шоу принцесс · 2 актёра", meta: "60 мин · по теме «Принцессы»", price: 160,
      tone: "sun", rating: "5.0", tag: "аниматор", fit: true,
      desc: "Интерактивная программа с двумя актёрами: квесты, танцы, сюжетная линия.",
      details: [["Длительность", "60 минут"], ["Актёров", "2"], ["Реквизит", "включён"], ["Возраст", "4–10 лет"]],
    },
    {
      id: "a2", title: "Научное шоу с опытами", meta: "45 мин · азот, молнии", price: 190,
      tone: "mint", rating: "4.9", tag: "аниматор",
      desc: "Жидкий азот, плазменный шар, химические реакции. Дети участвуют в безопасных экспериментах.",
      details: [["Длительность", "45 минут"], ["Эффекты", "азот, молнии"], ["Безопасность", "инструктор"]],
    },
    {
      id: "a3", title: "Мыльные пузыри · большое шоу", meta: "40 мин · финал-гигант", price: 140,
      tone: "soft", rating: "4.8", tag: "аниматор",
      desc: "Шоу гигантских мыльных пузырей с финалом «ребёнок внутри пузыря».",
      details: [["Длительность", "40 минут"], ["Финал", "ребёнок в пузыре"], ["Возраст", "2+"]],
    },
  ],
  food: [
    {
      id: "f1", title: "Торт на заказ · 3 кг", meta: "крем, без красителей", price: 120,
      tone: "warm", rating: "5.0", tag: "торт",
      desc: "Авторский торт по вашей теме: натуральный крем, без искусственных красителей.",
      details: [["Вес", "3 кг (~15 порций)"], ["Крем", "натуральный"], ["Тема", "оформление по запросу"]],
    },
    {
      id: "f2", title: "Кэнди-бар · сладкий стол", meta: "на 12 детей", price: 160,
      tone: "sun", rating: "4.8", tag: "еда",
      desc: "Сладкий стол в цветах праздника: капкейки, макаруны, маршмеллоу, лимонад.",
      details: [["Порций", "на 12 детей"], ["Стойка", "оформление включено"], ["Состав", "6 позиций"]],
    },
  ],
  decor: [
    {
      id: "d1", title: "Фотозона + шары по теме", meta: "монтаж включён", price: 140,
      tone: "soft", rating: "4.9", tag: "декор", fit: true,
      desc: "Тематическая фотозона с аркой из шаров, фоном и реквизитом. Монтаж и демонтаж включены.",
      details: [["Состав", "арка + фон + реквизит"], ["Монтаж", "включён"], ["Тема", "на выбор"]],
    },
    {
      id: "d2", title: "Аквагрим для гостей", meta: "1 час · художник", price: 90,
      tone: "mint", rating: "4.7", tag: "декор",
      desc: "Художник по аквагриму на 1 час: рисунки по теме праздника, гипоаллергенные краски.",
      details: [["Длительность", "1 час"], ["Краски", "гипоаллергенные"], ["Гостей", "до 12"]],
    },
  ],
};

const CATEGORIES: { key: CatKey; label: string; icon: string; optional: boolean }[] = [
  { key: "venue", label: "Площадка", icon: "🎪", optional: false },
  { key: "animator", label: "Аниматор", icon: "✨", optional: true },
  { key: "food", label: "Торт и еда", icon: "🍰", optional: true },
  { key: "decor", label: "Декор", icon: "🎈", optional: true },
];

// ─── Detail Modal ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: 44, height: 26, borderRadius: 99, flexShrink: 0,
        padding: 0, border: 0, cursor: "pointer", transition: "background .2s",
        background: on ? "#E86A3A" : "rgba(20,18,16,.18)",
        position: "relative",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 99,
        background: "#fff", boxShadow: "0 2px 5px rgba(20,18,16,.25)",
        transition: "left .2s cubic-bezier(.2,.7,.2,1)",
      }} />
    </button>
  );
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#E8B935" stroke="none">
      <path d="M12 2l3.1 6.4 7 .9-5.1 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7L1.9 9.3l7-.9z" />
    </svg>
  );
}

function DetailModal({
  item,
  catKey,
  selected,
  onToggle,
  onClose,
}: {
  item: MockOffer;
  catKey: CatKey;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [off, setOff] = useState<Record<string, boolean>>({});

  const bundled = item.bundled ?? null;
  const total = bundled
    ? item.price - bundled.reduce((s, b) => s + (b.optional && off[b.key] ? b.refund : 0), 0)
    : item.price;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, background: "rgba(20,18,16,.5)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative", width: "100%", maxWidth: 560, maxHeight: "90vh",
          overflowY: "auto", background: "#fff", borderRadius: 24,
          boxShadow: "0 60px 120px -30px rgba(0,0,0,.55)",
        }}
      >
        {/* Cover */}
        <div style={{ position: "relative", aspectRatio: "16/9", background: TONES[item.tone] }}>
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)" }} />
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
            {item.allIn && (
              <span style={{ padding: "5px 10px", borderRadius: 99, background: "#141210", color: "#FAF7F1", fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>
                ★ всё включено
              </span>
            )}
            <span style={{ padding: "5px 10px", borderRadius: 99, background: "rgba(255,255,255,.94)", color: "#3A332B", fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <StarIcon /> {item.rating}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              position: "fixed", top: 24, right: 24, zIndex: 210,
              width: 40, height: 40, borderRadius: 99,
              background: "#fff", color: "#141210",
              border: "1px solid rgba(20,18,16,.18)",
              boxShadow: "0 4px 16px rgba(20,18,16,.15)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 24px 24px" }}>
          <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "#C24E22" }}>
            ● {item.tag}
          </span>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 400, margin: "10px 0 0", fontSize: 30, lineHeight: 1.05, letterSpacing: "-.02em", color: "#141210" }}>
            {item.title}
          </h3>
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.6, color: "#3A332B" }}>{item.desc}</p>

          {/* Bundled includes */}
          {bundled && (
            <div style={{ marginTop: 18, padding: "16px 18px", background: "#FFE8DC", border: "1px solid rgba(232,106,58,.28)", borderRadius: 14 }}>
              <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "#C24E22", marginBottom: 4 }}>
                ● что входит в цену
              </div>
              {bundled.map((b, i) => {
                const isOn = !(b.optional && off[b.key]);
                const dimmed = b.optional && off[b.key];
                return (
                  <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid rgba(232,106,58,.18)", opacity: dimmed ? 0.55 : 1, transition: "opacity .2s" }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, border: "1px solid rgba(232,106,58,.2)" }}>
                      {CAT_ICON[b.cat]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "#C24E22", marginBottom: 2 }}>
                        {CAT_LABEL[b.cat]}
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.1, letterSpacing: "-.01em", color: "#141210" }}>{b.name}</div>
                      {dimmed ? (
                        <div style={{ fontSize: 12, color: "#C24E22", marginTop: 3, fontWeight: 500 }}>
                          {b.refund > 0 ? <span>вычтется −{b.refund} <BelarusianRubleIcon /></span> : "вам не привезут, цена не изменится"}
                        </div>
                      ) : (
                        <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, color: "rgba(20,18,16,.55)", marginTop: 3 }}>{b.meta}</div>
                      )}
                    </div>
                    {b.optional ? (
                      <Toggle on={isOn} onChange={() => setOff((p) => ({ ...p, [b.key]: !p[b.key] }))} />
                    ) : (
                      <span style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 99, background: "rgba(232,106,58,.12)", color: "#C24E22", fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>
                        входит
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Details */}
          {item.details && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(20,18,16,.55)", marginBottom: 10 }}>
                детали
              </div>
              {item.details.map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid rgba(20,18,16,.10)" }}>
                  <span style={{ fontSize: 14, color: "rgba(20,18,16,.55)" }}>{k}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#141210", textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div style={{ flexShrink: 0, padding: "16px 24px", borderTop: "1px solid rgba(20,18,16,.10)", background: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, color: "rgba(20,18,16,.55)", letterSpacing: ".08em", textTransform: "uppercase" }}>
              стоимость
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1, letterSpacing: "-.02em", color: "#141210" }}>
              {total}
              <BelarusianRubleIcon className="ml-1 text-[rgba(20,18,16,.55)]" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onToggle(); if (!selected) onClose(); }}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              height: 52, padding: "0 24px", borderRadius: 999,
              fontWeight: 600, fontSize: 15, border: 0, cursor: "pointer",
              background: "#E86A3A", color: "#fff",
              transition: "background .2s",
            }}
          >
            {selected ? "✓ Убрать из плана" : <span>Добавить · {total} <BelarusianRubleIcon /> →</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exec Card ───────────────────────────────────────────────────────────────

function ExecCard({
  item,
  selected,
  onToggle,
  onOpen,
}: {
  item: MockOffer;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${selected ? "#E86A3A" : "rgba(20,18,16,.10)"}`,
        boxShadow: selected
          ? "0 18px 40px -22px rgba(232,106,58,.5)"
          : "0 1px 3px rgba(20,18,16,.04)",
        transition: "all .18s",
      }}
    >
      {/* Media */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={selected ? "Убрать" : "Выбрать"}
        style={{
          position: "relative",
          aspectRatio: "16/9",
          background: TONES[item.tone],
          border: 0,
          padding: 0,
          cursor: "pointer",
          width: "100%",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 12px)" }} />
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {item.allIn && (
            <span style={{ padding: "4px 9px", borderRadius: 99, background: "#141210", color: "#FAF7F1", fontFamily: "var(--font-mono, ui-monospace)", fontSize: 9, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>
              ★ всё включено
            </span>
          )}
          {item.fit && (
            <span style={{ padding: "4px 9px", borderRadius: 99, background: "rgba(255,255,255,.94)", color: "#C24E22", fontFamily: "var(--font-mono, ui-monospace)", fontSize: 9, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>
              ● по теме
            </span>
          )}
        </div>
        <span style={{ position: "absolute", top: 10, right: 10, padding: "4px 8px", borderRadius: 99, background: "rgba(20,18,16,.78)", color: "#FAF7F1", fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <StarIcon /> {item.rating}
        </span>
        <span style={{ position: "absolute", bottom: 10, right: 10, width: 30, height: 30, borderRadius: 99, background: selected ? "#E86A3A" : "rgba(255,255,255,.94)", border: `1px solid ${selected ? "transparent" : "rgba(20,18,16,.10)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: selected ? "#fff" : "rgba(20,18,16,.55)" }}>
          {selected ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          ) : (
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: -2 }}>+</span>
          )}
        </span>
      </button>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "#C24E22" }}>
          ● {item.tag}
        </span>
        <button type="button" onClick={onOpen} style={{ textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}>
          <h4 style={{ fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)", fontWeight: 500, margin: 0, fontSize: 15, lineHeight: 1.3, letterSpacing: "-.01em", color: "#141210" }}>
            {(() => {
              const [main, sub] = item.title.split(" · ");
              return sub ? (
                <>{main} <em style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 400 }}>({sub})</em></>
              ) : item.title;
            })()}
          </h4>
        </button>

        {item.includes && item.includes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {item.includes.map((k) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 99, background: "#FFE8DC", color: "#C24E22", fontSize: 11, fontWeight: 500 }}>
                <span style={{ fontSize: 11 }}>{CAT_ICON[k]}</span> {CAT_LABEL[k]}
              </span>
            ))}
            <span style={{ fontSize: 11, color: "rgba(20,18,16,.55)", alignSelf: "center" }}>в цене</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "auto" }}>
          <button type="button" onClick={onOpen} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontSize: 12, color: "#3A332B", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "underline", textUnderlineOffset: 3 }}>
            Подробнее
          </button>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1, letterSpacing: "-.02em", color: "#141210", whiteSpace: "nowrap" }}>
            {item.price}
            <BelarusianRubleIcon className="ml-1 text-[rgba(20,18,16,.55)]" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── StepPick ────────────────────────────────────────────────────────────────

interface Props {
  builder: BirthdayBuilderWithGate;
}

export function StepPick({ builder }: Props) {
  const { state, selectBase, toggleAddon } = builder;
  const { selectedBaseId, selectedAddonIds } = state.selection;

  const [detail, setDetail] = useState<{ cat: CatKey; id: string } | null>(null);

  const isSelected = (cat: CatKey, id: string) => {
    if (cat === "venue") return selectedBaseId === id;
    return selectedAddonIds.includes(id);
  };

  const toggle = (cat: CatKey, id: string) => {
    if (cat === "venue") {
      selectBase(selectedBaseId === id ? "" : id);
    } else {
      toggleAddon(id);
    }
  };

  const detailItem = detail ? CATALOG[detail.cat].find((x) => x.id === detail.id) : null;
  const detailSelected = detail ? isSelected(detail.cat, detail.id) : false;

  return (
    <div>
      <span
        style={{
          fontFamily: "var(--font-mono, ui-monospace)",
          fontSize: 11,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "#C24E22",
        }}
      >
        ● Шаг 4 · подбор исполнителей
      </span>

      <h2
        style={{
          fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
          fontWeight: 700,
          margin: "14px 0 0",
          fontSize: 50,
          fontStyle: "normal",
          lineHeight: 0.98,
          letterSpacing: "-.025em",
          color: "#141210",
        }}
      >
        Соберите{" "}
        <span style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 400, color: "#E86A3A" }}>команду</span>
      </h2>

      <p style={{ maxWidth: 560, marginTop: 14, fontSize: 16, color: "#3A332B" }}>
        Площадка нужна обязательно, остальное — по желанию. Карточки с меткой{" "}
        <strong style={{ color: "#141210" }}>«всё включено»</strong> уже содержат услуги — нажмите «Подробнее».
      </p>

      {CATEGORIES.map((cat, ci) => (
        <div key={cat.key} style={{ marginTop: ci === 0 ? 28 : 40 }}>
          {/* Kicker row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{cat.icon}</span>
            <h3 style={{ fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)", fontWeight: 600, margin: 0, fontSize: 20, letterSpacing: "-.01em", color: "#141210" }}>
              {cat.label}
            </h3>
            {cat.optional ? (
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(20,18,16,.55)" }}>
                можно пропустить
              </span>
            ) : (
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "#C24E22" }}>
                ● нужно выбрать
              </span>
            )}
            <span style={{ flex: 1, height: 1, background: "rgba(20,18,16,.10)" }} />
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, color: "rgba(20,18,16,.55)" }}>
              {cat.key === "venue" && selectedBaseId && CATALOG.venue.some((v) => v.id === selectedBaseId) ? "1 выбрано" : cat.key !== "venue" && selectedAddonIds.filter((id) => CATALOG[cat.key].some((o) => o.id === id)).length > 0 ? `${selectedAddonIds.filter((id) => CATALOG[cat.key].some((o) => o.id === id)).length} выбрано` : "0 выбрано"}
            </span>
          </div>

          {/* Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {CATALOG[cat.key].map((item) => (
              <ExecCard
                key={item.id}
                item={item}
                selected={isSelected(cat.key, item.id)}
                onToggle={() => toggle(cat.key, item.id)}
                onOpen={() => setDetail({ cat: cat.key, id: item.id })}
              />
            ))}
          </div>
        </div>
      ))}

      {detail && detailItem && (
        <DetailModal
          item={detailItem}
          catKey={detail.cat}
          selected={detailSelected}
          onToggle={() => toggle(detail.cat, detail.id)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
