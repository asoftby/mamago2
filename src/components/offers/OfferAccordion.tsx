"use client";

import { useState } from "react";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { cn } from "@/lib/utils";

/* ─── Mock fallbacks ─────────────────────────────────────────────────────── */

const MOCK_DAY_SCHEDULE: NonNullable<OfferPageData["daySchedule"]> = [
  { time: "08:00", title: "Подъём · зарядка", sub: "На свежем воздухе" },
  { time: "09:00", title: "Завтрак", sub: "5-разовое питание, учитываем аллергии" },
  { time: "10:00", title: "Основное занятие", sub: "Программа по расписанию", accent: true },
  { time: "12:30", title: "Спорт · игры", sub: "Подвижные активности на улице" },
  { time: "13:30", title: "Обед · тихий час", sub: "60 минут отдыха" },
  { time: "16:00", title: "Мастер-классы", sub: "По выбору участника", accent: true },
  { time: "19:00", title: "Ужин · свободное время", sub: "" },
  { time: "22:00", title: "Отбой" },
];

const MOCK_HOUSING: Array<[string, string]> = [
  ["База", "База отдыха"],
  ["Комнаты", "Комнаты по 4–6 человек с удобствами"],
  ["Питание", "5-разовое, учитываем аллергии"],
  ["Безопасность", "Огороженная территория, охрана 24/7"],
  ["Медицина", "Медпункт на территории, врач круглосуточно"],
  ["Трансфер", "Трансфер из города включён в стоимость"],
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s || s === "true" || s === "false") return true;
  if (/^<p>\s*<\/p>$/i.test(s)) return true;
  return false;
}

const HOUSING_LABEL_MAP: Record<string, string> = {
  type: "База",
  rooms: "Комнаты",
  meals: "Питание",
  safety: "Безопасность",
  medical: "Медицина",
  transfer: "Трансфер",
  conditions: "Условия",
  whattobring: "Что взять",
  safetyinfo: "Безопасность",
  medicalinfo: "Медицина",
  provided: "Проживание",
  resort_base: "База",
};

/* ─── AccordionRow ────────────────────────────────────────────────────────── */

function AccordionRow({
  kicker,
  title,
  isOpen,
  onToggle,
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: "1px solid rgba(20,18,16,0.10)" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "16px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          border: 0,
        }}
      >
        <span style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: isOpen ? "#C24E22" : "rgba(20,18,16,0.45)",
              minWidth: 24,
              flexShrink: 0,
            }}
          >
            {kicker}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 30,
              lineHeight: 1,
              letterSpacing: "-.015em",
              color: "#141210",
              fontWeight: 400,
            }}
          >
            {title}
          </span>
        </span>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 99,
            border: `1px solid ${isOpen ? "#141210" : "rgba(20,18,16,0.18)"}`,
            background: isOpen ? "#141210" : "transparent",
            color: isOpen ? "#FAF7F1" : "rgba(20,18,16,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            lineHeight: 1,
            flexShrink: 0,
            transition: "all .2s",
          }}
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      <div
        style={{
          maxHeight: isOpen ? 1200 : 0,
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height .35s cubic-bezier(.2,.7,.2,1), opacity .25s",
        }}
      >
        <div style={{ padding: "4px 0 20px 38px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Section renderers ───────────────────────────────────────────────────── */

function DescriptionContent({ about, description }: { about?: string[]; description?: string }) {
  if (about && about.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 580 }}>
        {about.map((para, i) => (
          <p
            key={i}
            style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#3A332B" }}
            dangerouslySetInnerHTML={{ __html: para }}
          />
        ))}
      </div>
    );
  }
  if (description) {
    return (
      <RichContentRenderer
        html={description}
        className={cn(
          "prose-p:my-1.5 prose-p:text-[14px] prose-p:leading-[1.55] prose-p:text-[#3A332B]",
          "prose-ul:my-2 prose-li:text-[14px] prose-li:text-[#3A332B]",
          "prose-strong:font-semibold prose-strong:text-[#141210]",
          "max-w-[580px]",
        )}
      />
    );
  }
  return null;
}

function DayScheduleContent({ items }: { items: NonNullable<OfferPageData["daySchedule"]> }) {
  return (
    <div style={{ position: "relative", paddingLeft: 6, maxWidth: 580 }}>
      <span style={{
        position: "absolute",
        left: 54,
        top: 6,
        bottom: 6,
        width: 1,
        background: "rgba(20,18,16,0.10)",
      }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr",
              gap: 18,
              padding: "10px 0",
              borderBottom: i < items.length - 1 ? "1px dashed rgba(20,18,16,0.10)" : "none",
            }}
          >
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              {item.time && (
                <span style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: ".02em",
                  color: item.accent ? "#C24E22" : "#141210",
                  width: 48,
                  textAlign: "left",
                }}>
                  {item.time}
                </span>
              )}
              <span style={{
                position: "absolute",
                left: 48,
                top: "50%",
                transform: "translate(50%, -50%)",
                width: item.accent ? 10 : 7,
                height: item.accent ? 10 : 7,
                borderRadius: 99,
                background: item.accent ? "#E86A3A" : "#141210",
                border: "2px solid #FAF7F1",
                boxShadow: item.accent ? "0 0 0 3px rgba(232,106,58,0.18)" : "none",
                zIndex: 1,
              }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.005em", color: "#141210" }}>
                {item.title}
              </span>
              {item.sub && (
                <span style={{ fontSize: 13, color: "rgba(20,18,16,0.55)", lineHeight: 1.4 }}>
                  {item.sub}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HousingContent({ entries }: { entries: Array<[string, string]> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px", maxWidth: 580 }}>
      {entries.map(([label, value], i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "rgba(20,18,16,0.45)",
          }}>
            {label}
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: "#3A332B" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

interface OfferAccordionProps {
  data: OfferPageData;
}

export function OfferAccordion({ data }: OfferAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(
    () => new Set(["about", "schedule", "housing"]),
  );
  const toggle = (k: string) =>
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const hasDescription = Boolean(data.about?.length || data.description);

  const dayScheduleItems = data.daySchedule?.length
    ? data.daySchedule
    : MOCK_DAY_SCHEDULE;

  // Build housing entries: use real data filtered of garbage, or fall back to mock
  const realHousingEntries = data.accommodation
    ? Object.entries(data.accommodation)
        .map(([k, v]): [string, string] => [
          HOUSING_LABEL_MAP[k] ?? k,
          String(v ?? "").trim(),
        ])
        .filter(([, v]) => !isEmptyValue(v))
    : [];
  const housingEntries = realHousingEntries.length > 0 ? realHousingEntries : MOCK_HOUSING;

  if (!hasDescription && dayScheduleItems.length === 0 && housingEntries.length === 0) return null;

  let kickerIndex = 1;

  return (
    <div>
      {hasDescription && (
        <AccordionRow
          kicker={String(kickerIndex++).padStart(2, "0")}
          title={<><span style={{ fontFamily: "var(--font-sans)" }}>Описание </span><span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "var(--primary)" }}>предложения</span></>}
          isOpen={openItems.has("about")}
          onToggle={() => toggle("about")}
        >
          <DescriptionContent about={data.about} description={data.description} />
        </AccordionRow>
      )}

      <AccordionRow
        kicker={String(kickerIndex++).padStart(2, "0")}
        title={<><span style={{ fontFamily: "var(--font-sans)" }}>Расписание </span><span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "var(--primary)" }}>дня</span></>}
        isOpen={openItems.has("schedule")}
        onToggle={() => toggle("schedule")}
      >
        <DayScheduleContent items={dayScheduleItems} />
      </AccordionRow>

      <AccordionRow
        kicker={String(kickerIndex++).padStart(2, "0")}
        title="Проживание"
        isOpen={openItems.has("housing")}
        onToggle={() => toggle("housing")}
      >
        <HousingContent entries={housingEntries} />
      </AccordionRow>

      <div style={{ borderTop: "1px solid rgba(20,18,16,0.10)" }} />
    </div>
  );
}
