"use client";

import React, { useState } from "react";
import Link from "next/link";

/* ── Icons ── */
const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.6 4 4 1.6-4 1.6L12 14l-1.6-3.8L6.4 8.6 10.4 7z"/>
    <path d="M19 14l.8 1.9L21.7 17l-1.9.8L19 19.7l-.8-1.9L16.3 17l1.9-.8z"/>
  </svg>
);
const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18"/>
  </svg>
);

/* ── Step dots ── */
function StepDots({ idx, total }: { idx: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: i === idx ? 22 : 6,
            height: 6,
            borderRadius: 99,
            background: i === idx ? "#E86A3A" : i < idx ? "#141210" : "rgba(20,18,16,.18)",
            transition: "all .25s",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

/* ── Modal header ── */
function ModalHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: "22px 24px 18px",
        borderBottom: "1px solid rgba(20,18,16,.10)",
        background: "#FAF7F1",
      }}
    >
      <h2
        className="font-display"
        style={{ margin: 0, fontSize: 32, lineHeight: 1, letterSpacing: "-.02em", color: "#141210" }}
      >
        Мой <em style={{ fontStyle: "italic", color: "#C24E22" }}>план</em>
      </h2>
      {onClose && (
        <button
          aria-label="Закрыть"
          onClick={onClose}
          className="guest-x-btn"
          style={{
            width: 36, height: 36, borderRadius: 99,
            border: "1px solid rgba(20,18,16,.18)",
            color: "#3A332B",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", cursor: "pointer", flexShrink: 0,
            transition: "all .2s",
          }}
        >
          <XIcon/>
        </button>
      )}
    </div>
  );
}

type FilterState = {
  who: "me" | "kids" | "free";
  when: "today" | "tomorrow" | "weekend";
  format: "calm" | "active" | "any";
};

/* ══════════════════════════════════════════════════════
   STEP 1 — Hook
══════════════════════════════════════════════════════ */
function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div
      className="guest-modal"
      style={{
        width: "calc(100% - 36px)",
        maxWidth: 540,
        background: "#F6F2EA",
        borderRadius: 24,
        boxShadow: "0 60px 120px -30px rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.5) inset",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ModalHeader/>
      <div
        className="flex flex-col items-center text-center"
        style={{ padding: "32px 28px 30px", gap: 18 }}
      >
        {/* AI badge */}
        <span
          className="font-mono inline-flex items-center gap-2 uppercase"
          style={{
            padding: "6px 12px", borderRadius: 99,
            background: "#FFE8DC", color: "#C24E22",
            fontSize: 10, fontWeight: 600, letterSpacing: ".14em",
          }}
        >
          <SparkIcon/> ai · 10 секунд
        </span>

        <h3
          className="font-display"
          style={{
            margin: 0,
            fontSize: "clamp(34px, 6vw, 44px)",
            lineHeight: 1.02,
            letterSpacing: "-.025em",
            color: "#141210",
            maxWidth: 420,
          }}
        >
          Соберём план<br/>
          на&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>сегодня</em>
          {" "}за&nbsp;10&nbsp;секунд
        </h3>

        <p style={{ margin: "4px 0 6px", fontSize: 15, lineHeight: 1.5, color: "rgba(20,18,16,.55)", maxWidth: 380 }}>
          Подберём активности под&nbsp;вас и&nbsp;вашего ребёнка — без анкет и&nbsp;регистрации.
        </p>

        <button
          onClick={onNext}
          className="guest-cta-accent"
          style={{
            width: "100%", maxWidth: 340, height: 60, fontSize: 16,
            borderRadius: 99,
            background: "linear-gradient(180deg, #FBA77B, #E86A3A)",
            color: "#fff",
            fontWeight: 600, letterSpacing: "-.005em",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: "pointer", border: 0,
            boxShadow: "0 18px 40px -12px rgba(232,106,58,.6)",
            transition: "filter .2s, box-shadow .2s",
          }}
        >
          <SparkIcon/> Реши за меня <ArrowIcon/>
        </button>

        {/* Trust line */}
        <div
          className="font-mono flex items-center gap-3.5 uppercase"
          style={{ marginTop: 8, fontSize: 10, letterSpacing: ".1em", color: "rgba(20,18,16,.55)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "#E86A3A", flexShrink: 0, display: "inline-block" }}/>
            без регистрации
          </span>
          <span style={{ width: 3, height: 3, borderRadius: 99, background: "rgba(20,18,16,.55)", flexShrink: 0, display: "inline-block" }}/>
          <span>3 подбора бесплатно</span>
        </div>

        <Link
          href="/login"
          style={{ marginTop: 4, fontSize: 13, color: "rgba(20,18,16,.55)", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          Я сама подберу →
        </Link>
      </div>

      <div
        className="flex justify-center"
        style={{ padding: "14px 22px", borderTop: "1px solid rgba(20,18,16,.10)" }}
      >
        <StepDots idx={0} total={3}/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STEP 2 — Filters
══════════════════════════════════════════════════════ */
function Step2({
  onNext,
  onBack,
  filters,
  onChange,
}: {
  onNext: () => void;
  onBack: () => void;
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  function Group<K extends keyof FilterState>({
    label,
    field,
    options,
  }: {
    label: string;
    field: K;
    options: Array<{ key: FilterState[K]; label: string }>;
  }) {
    return (
      <div className="flex flex-col items-center" style={{ gap: 12 }}>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: ".14em", color: "rgba(20,18,16,.55)" }}
        >
          {label}
        </span>
        <div className="flex flex-wrap justify-center" style={{ gap: 8 }}>
          {options.map((o) => {
            const isOn = filters[field] === o.key;
            return (
              <button
                key={String(o.key)}
                onClick={() => onChange({ ...filters, [field]: o.key })}
                style={{
                  height: 42, padding: "0 22px", borderRadius: 99,
                  background: isOn ? "#FFE8DC" : "#FAF7F1",
                  border: isOn ? "1px solid transparent" : "1px solid rgba(20,18,16,.10)",
                  color: isOn ? "#C24E22" : "#141210",
                  fontSize: 15, fontWeight: isOn ? 600 : 500,
                  cursor: "pointer", transition: "all .15s",
                  fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "calc(100% - 36px)",
        maxWidth: 540,
        background: "#F6F2EA",
        borderRadius: 24,
        boxShadow: "0 60px 120px -30px rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.5) inset",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ModalHeader/>
      <div className="flex flex-col" style={{ padding: "28px 28px 24px", gap: 24 }}>
        <Group label="Кто идёт" field="who" options={[
          { key: "me", label: "Я" },
          { key: "kids", label: "Дети" },
          { key: "free", label: "Свободный поиск" },
        ]}/>
        <Group label="Когда" field="when" options={[
          { key: "today", label: "Сегодня" },
          { key: "tomorrow", label: "Завтра" },
          { key: "weekend", label: "Выходные" },
        ]}/>
        <Group label="Формат" field="format" options={[
          { key: "calm", label: "Спокойно" },
          { key: "active", label: "Активно" },
          { key: "any", label: "Не важно" },
        ]}/>

        <button
          onClick={onNext}
          style={{
            width: "100%", height: 58, fontSize: 16,
            borderRadius: 99,
            background: "linear-gradient(180deg, #FBA77B, #E86A3A)",
            color: "#fff",
            fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: "pointer", border: 0,
            boxShadow: "0 18px 40px -12px rgba(232,106,58,.55)",
            marginTop: 6,
            fontFamily: "inherit",
          }}
        >
          Найди варианты <ArrowIcon/>
        </button>
      </div>

      <div
        className="flex justify-between items-center"
        style={{ padding: "14px 22px", borderTop: "1px solid rgba(20,18,16,.10)" }}
      >
        <button
          onClick={onBack}
          style={{ fontSize: 13, color: "rgba(20,18,16,.55)", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit" }}
        >
          ← Назад
        </button>
        <StepDots idx={1} total={3}/>
        <span style={{ visibility: "hidden", fontSize: 13 }}>x</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STEP 3 — Recommendation
══════════════════════════════════════════════════════ */
function Step3({
  onBack,
  attemptsLeft,
  onRefresh,
}: {
  onBack: () => void;
  attemptsLeft: number;
  onRefresh: () => void;
}) {
  const [saved, setSaved] = useState(false);

  const d = new Date();
  const DAYS = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const dateLabel = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  return (
    <div
      style={{
        width: "calc(100% - 36px)",
        maxWidth: 560,
        background: "#F6F2EA",
        borderRadius: 24,
        boxShadow: "0 60px 120px -30px rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.5) inset",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ModalHeader/>
      <div className="flex flex-col" style={{ padding: "22px 24px 22px", gap: 16 }}>
        <div>
          <h3
            className="font-display"
            style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: "-.02em", color: "#141210" }}
          >
            Вот что мы подобрали для&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>вас</em>
          </h3>
          <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
            <span style={{ fontSize: 14, color: "rgba(20,18,16,.55)" }}>{dateLabel}</span>
          </div>
        </div>

        {/* Kicker */}
        <div className="flex items-center gap-3" style={{ marginTop: 4 }}>
          <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: ".14em", color: "rgba(20,18,16,.55)" }}>
            Утро
          </span>
          <span style={{ flex: 1, height: 1, background: "rgba(20,18,16,.10)" }}/>
          <span className="font-mono" style={{ fontSize: 10, color: "rgba(20,18,16,.55)", letterSpacing: ".06em" }}>
            01 / 03
          </span>
        </div>

        {/* Recommendation card */}
        <div
          style={{
            position: "relative",
            padding: 18,
            background: "#FAF7F1",
            border: "1px solid rgba(20,18,16,.10)",
            borderRadius: 18,
            display: "grid",
            gridTemplateColumns: "96px 1fr auto",
            gap: 16,
            alignItems: "center",
          }}
        >
          <span
            className="font-mono inline-flex items-center gap-1.5 uppercase"
            style={{
              position: "absolute", top: -12, left: 18,
              padding: "5px 10px 5px 8px", borderRadius: 99,
              background: "#fff", border: "1px solid rgba(232,106,58,.28)",
              color: "#C24E22",
              fontSize: 10, fontWeight: 600, letterSpacing: ".12em",
              boxShadow: "0 6px 16px -6px rgba(232,106,58,.35)",
              zIndex: 1,
            }}
          >
            <SparkIcon/>
            Рекомендовано <strong style={{ fontWeight: 700 }}>mamaGo</strong>
          </span>

          {/* Image */}
          <div
            style={{
              width: 96, height: 96, borderRadius: 14,
              background: "linear-gradient(160deg, #F2C8A7, #E89460)",
              position: "relative", overflow: "hidden", flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute", inset: 0,
              background: "repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0 1px, transparent 1px 10px)",
            }}/>
          </div>

          {/* Body */}
          <div className="flex flex-col" style={{ gap: 5, minWidth: 0 }}>
            <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: ".14em", color: "rgba(20,18,16,.55)" }}>
              мастер-класс
            </span>
            <h4
              className="font-display"
              style={{ margin: 0, fontSize: 22, lineHeight: 1.08, letterSpacing: "-.015em", color: "#141210" }}
            >
              Занятие в&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>Британской школе</em>
            </h4>
            <span className="font-mono uppercase" style={{ fontSize: 11, color: "rgba(20,18,16,.55)", letterSpacing: ".04em" }}>
              ● Сегодня · 11:00 · Бесплатно
            </span>
          </div>

          {/* Save CTA */}
          <button
            onClick={() => setSaved(s => !s)}
            style={
              saved
                ? {
                    height: 44, padding: "0 18px", fontSize: 13, alignSelf: "center",
                    borderRadius: 99, background: "#141210", color: "#FAF7F1", border: 0,
                    fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                    transition: "background .2s", fontFamily: "inherit",
                  }
                : {
                    height: 44, padding: "0 18px", fontSize: 13, alignSelf: "center",
                    borderRadius: 99,
                    background: "linear-gradient(180deg, #FBA77B, #E86A3A)",
                    color: "#fff", border: 0,
                    fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                    boxShadow: "0 10px 24px -8px rgba(232,106,58,.5)",
                    fontFamily: "inherit",
                  }
            }
          >
            {saved ? "✓ В плане" : <><PlusIcon/> В план</>}
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          style={{
            width: "100%", height: 50, fontSize: 14,
            borderRadius: 99,
            background: "transparent",
            border: "1px solid rgba(232,106,58,.4)",
            color: "#C24E22",
            fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "border-color .15s",
            fontFamily: "inherit",
          }}
        >
          <RefreshIcon/> Ещё варианты
        </button>

        {/* Counter */}
        <div
          className="font-mono uppercase text-center"
          style={{ fontSize: 10, letterSpacing: ".1em", color: "rgba(20,18,16,.55)" }}
        >
          ● осталось {attemptsLeft}{" "}
          {attemptsLeft === 1 ? "подбор" : "подбора"} · затем войдите, чтобы продолжить
        </div>
      </div>

      <div
        className="flex justify-between items-center"
        style={{ padding: "14px 22px", borderTop: "1px solid rgba(20,18,16,.10)" }}
      >
        <button
          onClick={onBack}
          style={{ fontSize: 13, color: "rgba(20,18,16,.55)", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit" }}
        >
          ← Изменить
        </button>
        <StepDots idx={2} total={3}/>
        <span style={{ visibility: "hidden", fontSize: 13 }}>x</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STEP 4 — Auth gate
══════════════════════════════════════════════════════ */
function Step4({ onBack }: { onBack: () => void }) {
  const d = new Date();
  const DAYS = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

  return (
    <div
      style={{
        width: "calc(100% - 36px)",
        maxWidth: 540,
        background: "#F6F2EA",
        borderRadius: 24,
        boxShadow: "0 60px 120px -30px rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.5) inset",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ModalHeader/>
      <div className="flex flex-col" style={{ padding: "22px 24px 24px", gap: 16 }}>
        <div>
          <h3
            className="font-display"
            style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: "-.02em", color: "#141210" }}
          >
            Вот что мы подобрали для&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>вас</em>
          </h3>
          <div style={{ marginTop: 6, fontSize: 14, color: "rgba(20,18,16,.55)" }}>
            {DAYS[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]}
          </div>
        </div>

        {/* Auth card */}
        <div
          style={{
            position: "relative", overflow: "hidden",
            padding: "26px 24px 24px",
            background: "linear-gradient(135deg, #FFE8DC, #FFF1E5)",
            border: "1px solid rgba(232,106,58,.25)",
            borderRadius: 20,
            display: "flex", flexDirection: "column", gap: 12,
          }}
        >
          <span style={{
            position: "absolute", top: -40, right: -30, width: 160, height: 160, borderRadius: 99,
            background: "radial-gradient(circle, rgba(232,106,58,.22), transparent 65%)",
            pointerEvents: "none",
          }}/>

          <span
            className="font-mono inline-flex items-center gap-1.5 uppercase self-start"
            style={{
              padding: "4px 10px", borderRadius: 99,
              background: "#fff", color: "#C24E22",
              fontSize: 10, fontWeight: 600, letterSpacing: ".12em",
              position: "relative", zIndex: 1,
            }}
          >
            <SparkIcon/> подборы · 3 из 3
          </span>

          <h4
            className="font-display"
            style={{
              margin: 0, fontSize: 30, lineHeight: 1, letterSpacing: "-.02em", color: "#141210",
              position: "relative", zIndex: 1, maxWidth: 380,
            }}
          >
            Сохраним ваш план<br/>
            и&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>подберём ещё</em>
          </h4>

          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#3A332B", maxWidth: 380, position: "relative", zIndex: 1 }}>
            Войдите, чтобы оставить план на&nbsp;потом, получать напоминания и&nbsp;продолжить подбирать варианты.
          </p>

          <div className="flex flex-wrap gap-2" style={{ marginTop: 8, position: "relative", zIndex: 1 }}>
            <Link
              href="/login"
              className="inline-flex items-center gap-2.5"
              style={{
                height: 50, padding: "0 26px", borderRadius: 99,
                background: "linear-gradient(180deg, #FBA77B, #E86A3A)",
                color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none",
                boxShadow: "0 14px 32px -10px rgba(232,106,58,.55)",
              }}
            >
              Войти <ArrowIcon/>
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center"
              style={{
                height: 50, padding: "0 20px", borderRadius: 99,
                background: "transparent", color: "#141210",
                border: "1px solid rgba(20,18,16,.18)",
                fontSize: 14, fontWeight: 500, textDecoration: "none",
              }}
            >
              Регистрация
            </Link>
          </div>
        </div>

        {/* Locked preview */}
        <div
          className="flex items-center gap-3"
          style={{
            padding: "14px 16px",
            background: "#FAF7F1",
            border: "1px dashed rgba(20,18,16,.18)",
            borderRadius: 14,
            opacity: 0.65,
          }}
        >
          <span style={{
            width: 42, height: 42, borderRadius: 10,
            background: "linear-gradient(160deg, #F2C8A7, #E89460)",
            flexShrink: 0, display: "inline-block",
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              className="font-mono uppercase block"
              style={{ fontSize: 9, letterSpacing: ".14em", color: "rgba(20,18,16,.55)" }}
            >
              в плане · сохранится после входа
            </span>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.005em", marginTop: 2, color: "#141210" }}>
              Занятие в Британской школе
            </div>
          </div>
          <span style={{ fontSize: 18, color: "rgba(20,18,16,.55)" }}>🔒</span>
        </div>
      </div>

      <div
        className="flex justify-between items-center"
        style={{ padding: "14px 22px", borderTop: "1px solid rgba(20,18,16,.10)" }}
      >
        <button
          onClick={onBack}
          style={{ fontSize: 13, color: "rgba(20,18,16,.55)", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit" }}
        >
          ← Назад
        </button>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 10, letterSpacing: ".1em", color: "rgba(20,18,16,.55)" }}
        >
          ● шаг 3 · сохранение
        </span>
        <span style={{ visibility: "hidden", fontSize: 13 }}>x</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Root: PlanGuestFlow
══════════════════════════════════════════════════════ */
export function PlanGuestFlow() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [attemptsLeft, setAttemptsLeft] = useState(2);
  const [filters, setFilters] = useState<FilterState>({
    who: "me",
    when: "today",
    format: "any",
  });

  function handleRefresh() {
    if (attemptsLeft <= 0) {
      setStep(4);
    } else {
      setAttemptsLeft(n => n - 1);
    }
  }

  return (
    <>
      {/* Full-screen overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "18px",
        }}
      >
        {/* Dark background */}
        <div style={{ position: "absolute", inset: 0, background: "#2D2925" }}/>

        {/* Grain texture */}
        <div
          style={{
            position: "absolute", inset: 0, opacity: 0.04,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundRepeat: "repeat",
            backgroundSize: "120px",
          }}
        />

        {/* Modal */}
        <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", justifyContent: "center" }}>
          {step === 1 && <Step1 onNext={() => setStep(2)}/>}
          {step === 2 && (
            <Step2
              filters={filters}
              onChange={setFilters}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              onBack={() => setStep(2)}
              attemptsLeft={attemptsLeft}
              onRefresh={handleRefresh}
            />
          )}
          {step === 4 && <Step4 onBack={() => setStep(3)}/>}
        </div>
      </div>

      <style>{`
        .guest-x-btn:hover { background: #141210 !important; color: #fff !important; border-color: #141210 !important; }
        .guest-cta-accent:hover { filter: brightness(1.05); }
      `}</style>
    </>
  );
}
