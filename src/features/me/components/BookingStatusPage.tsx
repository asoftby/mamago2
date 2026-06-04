"use client";

import { useState } from "react";
import { Check, X, Clock, Phone, Printer, Share2, Download, AlertTriangle, Star } from "lucide-react";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import type {
  AlternativePerformer,
  PerformerStatus,
  ScenarioTimelineItem,
  UserBirthdayPartyDetail,
} from "@/features/me/types/userBirthdayParty";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function parseTimeMinutes(timeStr: string): number {
  const m = timeStr.match(/\d{1,2}:\d{2}/);
  if (!m) return 9999;
  const [h, min] = m[0].split(":").map(Number);
  return h * 60 + min;
}

function firstTimePart(timeStr: string): string {
  const m = timeStr.match(/\d{1,2}:\d{2}/);
  return m ? m[0] : timeStr;
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

type PillVariant = "ok" | "warn" | "coral" | "hold" | "anchor";

const PILL_STYLES: Record<PillVariant, React.CSSProperties> = {
  ok:     { background: "rgba(31,138,91,.10)",  color: "#1F8A5B" },
  warn:   { background: "rgba(133,79,11,.10)",   color: "#854F0B" },
  coral:  { background: "#FAECE7",               color: "#993C1D" },
  hold:   { background: "rgba(20,18,16,.08)",    color: "rgba(20,18,16,.45)" },
  anchor: { background: "#141210",               color: "#FAF7F1" },
};

function Pill({
  variant,
  children,
}: {
  variant: PillVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 24,
        padding: "0 9px",
        borderRadius: 99,
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...PILL_STYLES[variant],
      }}
    >
      {children}
    </span>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: PerformerStatus }) {
  if (status === "CONFIRMED")
    return (
      <Pill variant="ok">
        <Check width={12} height={12} strokeWidth={2.5} />
        подтверждено
      </Pill>
    );
  if (status === "DECLINED")
    return (
      <Pill variant="coral">
        <X width={11} height={11} strokeWidth={2.5} />
        отказал
      </Pill>
    );
  return (
    <Pill variant="warn">
      <Clock width={11} height={11} strokeWidth={2} />
      ждём ответа
    </Pill>
  );
}

// ─── ProgressGrid ─────────────────────────────────────────────────────────────

function ProgressGrid({ items }: { items: ScenarioTimelineItem[] }) {
  const performers = items.filter((i) => i.type === "performer");
  const confirmed = performers.filter((v) => v.status === "CONFIRMED").length;
  const pending   = performers.filter((v) => v.status === "PENDING").length;
  const declined  = performers.filter((v) => v.status === "DECLINED").length;
  const confirmedTotal = performers
    .filter((v) => v.status === "CONFIRMED" && v.price != null)
    .reduce((s, v) => s + (v.price ?? 0), 0);
  const total = performers.reduce((s, v) => s + (v.price ?? 0), 0);
  const hasPending = pending > 0 || declined > 0;

  const cells: Array<{
    value: React.ReactNode;
    label: string;
    color: string;
    bg: string;
  }> = [
    { value: confirmed, label: "Подтверждено", color: "#1F8A5B", bg: "rgba(31,138,91,.10)" },
    { value: pending,   label: "Ожидаем",      color: "#854F0B", bg: "rgba(133,79,11,.10)" },
    { value: declined,  label: "Нужна замена",  color: "#D85A30", bg: "#FAECE7" },
    {
      value: hasPending ? `от ${confirmedTotal}` : total,
      label: `${BYN_SYMBOL} итого`,
      color: "#141210",
      bg: "#FAF7F1",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
        margin: "24px 0",
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            background: c.bg,
            border: "1px solid rgba(20,18,16,.10)",
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontSize: i === 3 ? 22 : 28,
              lineHeight: 1,
              letterSpacing: "-.02em",
              color: c.color,
            }}
          >
            {c.value}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: ".14em",
              marginTop: 6,
              color: c.color,
              opacity: 0.8,
            }}
          >
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── AlternativeCard ──────────────────────────────────────────────────────────

const ALT_GRADIENTS = [
  "linear-gradient(160deg, #F2C8A7, #E89460)",
  "linear-gradient(160deg, #CDE3D6, #9CC1AC)",
  "linear-gradient(160deg, #F6D567, #E8B935)",
  "linear-gradient(160deg, #E6DBC8, #C9BCA0)",
];

function AlternativeCard({
  alt,
  index,
  category,
  onSelect,
}: {
  alt: AlternativePerformer;
  index: number;
  category: string;
  onSelect?: () => void;
}) {
  const [added, setAdded] = useState(false);
  const gradient = ALT_GRADIENTS[index % ALT_GRADIENTS.length];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#FAF7F1",
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(20,18,16,.10)",
        boxShadow: "0 1px 3px rgba(20,18,16,.04)",
      }}
    >
      {/* Gradient image placeholder */}
      <div
        style={{
          position: "relative",
          aspectRatio: "16/9",
          background: gradient,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 12px)",
          }}
        />
        {alt.rating != null && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              padding: "4px 8px",
              borderRadius: 99,
              background: "rgba(20,18,16,.78)",
              color: "#FAF7F1",
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontSize: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Star width={10} height={10} fill="currentColor" strokeWidth={0} />
            {alt.rating.toFixed(1)}
          </span>
        )}
        <button
          type="button"
          onClick={() => { setAdded(true); onSelect?.(); }}
          aria-label="Добавить"
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            width: 34,
            height: 34,
            borderRadius: 99,
            background: added ? "#1F8A5B" : "#141210",
            border: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FAF7F1",
            fontSize: added ? 15 : 20,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          {added ? "✓" : "+"}
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "14px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
          flex: 1,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            textTransform: "uppercase",
            fontSize: 10,
            letterSpacing: ".14em",
            color: "#C24E22",
          }}
        >
          ● {category}
        </span>
        <div
          style={{
            fontFamily: "var(--font-display, Georgia, serif)",
            fontSize: 19,
            lineHeight: 1.1,
            letterSpacing: "-.015em",
            color: "#141210",
          }}
        >
          {alt.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: "auto",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontSize: 22,
              lineHeight: 1,
              letterSpacing: "-.02em",
              color: "#141210",
            }}
          >
            {alt.price}
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 11,
                color: "rgba(20,18,16,.55)",
                marginLeft: 3,
              }}
            >
              {BYN_SYMBOL}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Replacements ─────────────────────────────────────────────────────────────

function Replacements({
  item,
  dateRange,
}: {
  item: ScenarioTimelineItem;
  dateRange: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const alts = item.alternatives ?? [];
  if (alts.length === 0) return null;
  const category = item.subtitle?.split("·")[0].trim() ?? item.title;
  const visible = expanded ? alts : alts.slice(0, 2);
  const hidden = alts.length - 2;

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: "1px solid #F0997B",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          textTransform: "uppercase",
          fontSize: 10,
          letterSpacing: ".14em",
          color: "#993C1D",
          marginBottom: 12,
        }}
      >
        Похожие, свободные на {dateRange}:
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {visible.map((a, i) => (
          <AlternativeCard
            key={a.id}
            alt={a}
            index={i}
            category={category}
          />
        ))}
      </div>
      {!expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 10,
            width: "100%",
            height: 40,
            background: "transparent",
            border: "1px dashed #F0997B",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 13,
            color: "#993C1D",
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Ещё {hidden} {hidden === 1 ? "вариант" : hidden < 5 ? "варианта" : "вариантов"}
        </button>
      )}
    </div>
  );
}

// ─── VendorRow ────────────────────────────────────────────────────────────────

function VendorRow({
  item,
  dateRange,
}: {
  item: ScenarioTimelineItem;
  dateRange: string;
}) {
  const isDeclined  = item.status === "DECLINED";
  const isConfirmed = item.status === "CONFIRMED";

  return (
    <div
      style={{
        background: isDeclined ? "#FAECE7" : "#FAF7F1",
        border: `1px solid ${isDeclined ? "#F0997B" : "rgba(20,18,16,.10)"}`,
        borderRadius: 18,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        {/* Left */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* Category + status pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {item.subtitle && (
              <span
                style={{
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  textTransform: "uppercase",
                  fontSize: 10,
                  letterSpacing: ".14em",
                  color: "#D85A30",
                }}
              >
                ● {item.subtitle.split("·")[0].trim()}
              </span>
            )}
            {item.status && <StatusPill status={item.status} />}
          </div>

          {/* Title */}
          <h4
            style={{
              margin: 0,
              fontFamily: "var(--font-display, Georgia, serif)",
              fontSize: 20,
              lineHeight: 1.1,
              letterSpacing: "-.015em",
              textDecoration: isDeclined ? "line-through" : "none",
              color: isDeclined ? "#993C1D" : "#141210",
            }}
          >
            {item.title}
          </h4>

          {/* Time */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color: "rgba(20,18,16,.55)",
            }}
          >
            <Clock width={13} height={13} strokeWidth={1.7} />
            <span>{item.time}</span>
          </div>

          {/* Contact buttons for confirmed */}
          {isConfirmed && item.contact && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <a
                href={`tel:${item.contact.phone.replace(/[^\d+]/g, "")}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 99,
                  background: "#141210",
                  color: "#FAF7F1",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "-.005em",
                  textDecoration: "none",
                }}
              >
                <Phone width={14} height={14} strokeWidth={1.8} />
                Позвонить
              </a>
              {(item.contact.telegram || item.contact.messageHref) && (
                <a
                  href={item.contact.telegram ?? item.contact.messageHref ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 99,
                    background: "transparent",
                    border: "1px solid rgba(20,18,16,.18)",
                    color: "#141210",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Написать
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right — price */}
        {item.price != null && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                fontSize: 22,
                lineHeight: 1,
                letterSpacing: "-.02em",
                color: "#141210",
              }}
            >
              {item.price}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 10,
                color: "rgba(20,18,16,.55)",
              }}
            >
              {BYN_SYMBOL}
            </span>
          </div>
        )}
      </div>

      {/* Replacements for declined */}
      {isDeclined && (
        <Replacements item={item} dateRange={dateRange} />
      )}
    </div>
  );
}

// ─── InternalRow ──────────────────────────────────────────────────────────────

function InternalRow({ item }: { item: ScenarioTimelineItem }) {
  return (
    <div
      style={{
        background: "transparent",
        border: "1px solid rgba(20,18,16,.08)",
        borderRadius: 14,
        padding: "14px 18px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display, Georgia, serif)",
          fontSize: 17,
          lineHeight: 1.2,
          letterSpacing: "-.01em",
          color: "#3A332B",
        }}
      >
        {item.title}
      </div>
      {item.description && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "rgba(20,18,16,.55)",
          }}
        >
          {item.description}
        </div>
      )}
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

function PageHeader({
  party,
  performers,
  dateRange,
  startTime,
  totalPrice,
}: {
  party: UserBirthdayPartyDetail;
  performers: ScenarioTimelineItem[];
  dateRange: string;
  startTime: string;
  totalPrice: number;
}) {
  const confirmedCount = performers.filter((v) => v.status === "CONFIRMED").length;
  const declinedCount  = performers.filter((v) => v.status === "DECLINED").length;
  const allConfirmed   = confirmedCount === performers.length && performers.length > 0 && declinedCount === 0;
  const needsAction    = declinedCount > 0;
  const childDisplay   = [party.childName, party.childAgeLabel].filter(Boolean).join(" · ");

  return (
    <div style={{ paddingTop: 28, paddingBottom: 8 }}>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: ".14em",
          color: "#C24E22",
          marginBottom: 16,
        }}
      >
        ● {allConfirmed ? "Праздник подтверждён" : needsAction ? "Заявки отправлены · нужно действие" : "Заявки отправлены"}
      </span>

      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display, Georgia, serif)",
          fontSize: "clamp(40px, 6vw, 72px)",
          lineHeight: 0.95,
          letterSpacing: "-.025em",
          fontWeight: 400,
          color: "#141210",
        }}
      >
        Сценарий{" "}
        <em style={{ color: "#C24E22", fontStyle: "italic" }}>праздника</em>
      </h1>

      <p
        style={{
          marginTop: 14,
          marginBottom: 0,
          fontSize: 16,
          lineHeight: 1.5,
          color: "#3A332B",
        }}
      >
        Ниже — готовый сценарий дня, статусы ответов исполнителей и доступные альтернативы.
      </p>

      {/* Status summary card */}
      <div
        style={{
          marginTop: 20,
          padding: "16px 20px",
          background: "#FAF7F1",
          border: "1px solid rgba(20,18,16,.10)",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            textTransform: "uppercase",
            fontSize: 10,
            letterSpacing: ".14em",
            color: "rgba(20,18,16,.55)",
            marginBottom: 12,
          }}
        >
          статус сценария
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {childDisplay && (
            <span
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                background: "#F6F2EA",
                border: "1px solid rgba(20,18,16,.10)",
                fontSize: 13,
                fontWeight: 500,
                color: "#141210",
              }}
            >
              {childDisplay}
            </span>
          )}
          {dateRange && (
            <span
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                background: "#F6F2EA",
                border: "1px solid rgba(20,18,16,.10)",
                fontSize: 13,
                fontWeight: 500,
                color: "#141210",
              }}
            >
              {dateRange}
            </span>
          )}
          {startTime && (
            <span
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                background: "#F6F2EA",
                border: "1px solid rgba(20,18,16,.10)",
                fontSize: 13,
                fontWeight: 500,
                color: "#141210",
              }}
            >
              · {startTime}
            </span>
          )}
          <span
            style={{
              padding: "5px 12px",
              borderRadius: 99,
              background: "#F6F2EA",
              border: "1px solid rgba(20,18,16,.10)",
              fontSize: 13,
              fontWeight: 600,
              color: "#141210",
            }}
          >
            {totalPrice} {BYN_SYMBOL}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {confirmedCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#1F8A5B",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: "#1F8A5B",
                  flexShrink: 0,
                }}
              />
              Подтверждено {confirmedCount} из {performers.length} исполнителей
            </span>
          )}
          {declinedCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#D85A30",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: "#D85A30",
                  flexShrink: 0,
                }}
              />
              {declinedCount} {declinedCount === 1 ? "отказ" : "отказа"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TopNav ───────────────────────────────────────────────────────────────────

function TopNav({ onClose }: { onClose?: () => void }) {
  const handleShare = async () => {
    if (navigator?.share) {
      try { await navigator.share({ title: "Сценарий праздника", url: location.href }); } catch { /* noop */ }
    } else {
      navigator?.clipboard?.writeText(location.href);
    }
  };

  const handlePrint = () => window.print();

  const navBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    height: 34,
    padding: "0 14px",
    borderRadius: 99,
    border: "1px solid rgba(20,18,16,.18)",
    background: "transparent",
    fontSize: 13,
    fontWeight: 500,
    color: "#141210",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        background: "rgba(246,242,234,.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(20,18,16,.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "12px 24px",
          maxWidth: 820,
          margin: "0 auto",
        }}
      >
        <button type="button" onClick={onClose} style={navBtnStyle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
          Закрыть
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={handleShare} style={navBtnStyle}>
            <Share2 width={13} height={13} strokeWidth={1.7} />
            Поделиться
          </button>
          <button type="button" onClick={handlePrint} style={navBtnStyle}>
            <Printer width={13} height={13} strokeWidth={1.7} />
            Распечатать
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({
  performers,
  allConfirmed,
  child,
  dateRange,
  startTime,
  onBack,
}: {
  performers: ScenarioTimelineItem[];
  allConfirmed: boolean;
  child: string;
  dateRange: string;
  startTime: string;
  onBack?: () => void;
}) {
  const confirmedTotal = performers
    .filter((v) => v.status === "CONFIRMED" && v.price != null)
    .reduce((s, v) => s + (v.price ?? 0), 0);
  const confirmedCount = performers.filter((v) => v.status === "CONFIRMED").length;
  const declinedCount  = performers.filter((v) => v.status === "DECLINED").length;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: "rgba(246,242,234,.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid rgba(20,18,16,.10)",
        boxShadow: "0 -10px 30px -10px rgba(20,18,16,.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 24px",
          maxWidth: 820,
          margin: "0 auto",
        }}
      >
        {/* Meta chips */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {dateRange && (
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 11,
                color: "#3A332B",
                letterSpacing: ".04em",
                whiteSpace: "nowrap",
              }}
            >
              {dateRange}{startTime ? ` · ${startTime}` : ""}
            </span>
          )}
          <span style={{ color: "rgba(20,18,16,.18)" }}>·</span>
          <span
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontSize: 11,
              color: "#3A332B",
              whiteSpace: "nowrap",
            }}
          >
            {child}
          </span>
          <span style={{ color: "rgba(20,18,16,.18)" }}>·</span>
          <span
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontSize: 11,
              color: "#3A332B",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                fontSize: 16,
                verticalAlign: "middle",
              }}
            >
              {confirmedTotal}
            </span>{" "}
            {BYN_SYMBOL}
          </span>
          {confirmedCount > 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 11,
                color: "#1F8A5B",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "#1F8A5B", flexShrink: 0 }} />
              {confirmedCount} подтверждено
            </span>
          )}
          {declinedCount > 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 11,
                color: "#D85A30",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "#D85A30", flexShrink: 0 }} />
              {declinedCount} отказ
            </span>
          )}
        </div>

        {/* Action button */}
        {allConfirmed ? (
          <button
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 42,
              padding: "0 18px",
              borderRadius: 99,
              background: "#141210",
              color: "#FAF7F1",
              border: 0,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Download width={14} height={14} strokeWidth={1.7} />
            Скачать сценарий
          </button>
        ) : (
          <button
            type="button"
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 42,
              padding: "0 18px",
              borderRadius: 99,
              border: "1px solid rgba(20,18,16,.18)",
              background: "transparent",
              fontSize: 13,
              fontWeight: 500,
              color: "#141210",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ← Назад
          </button>
        )}
      </div>
    </div>
  );
}

// ─── BookingStatusPage ────────────────────────────────────────────────────────

export type BookingStatusPageProps = {
  party: UserBirthdayPartyDetail;
  title: string;
  dateTimeLine: string | null;
  onBack?: () => void;
};

export function BookingStatusPage({ party, onBack }: BookingStatusPageProps) {
  const items = party.timelineItems ?? [];
  const performers = items.filter((i) => i.type === "performer");
  const sortedItems = [...items].sort(
    (a, b) => parseTimeMinutes(a.time) - parseTimeMinutes(b.time),
  );

  const confirmedCount = performers.filter((v) => v.status === "CONFIRMED").length;
  const declinedCount  = performers.filter((v) => v.status === "DECLINED").length;
  const allConfirmed   = confirmedCount === performers.length && performers.length > 0 && declinedCount === 0;

  const dateLabel  = fmtDate(party.dateIso) ?? "";
  const startTime  = party.timeStart ?? "";
  const totalPrice = party.totalPrice ?? performers.reduce((s, v) => s + (v.price ?? 0), 0);
  const childDisplay = party.childName + (party.childAgeLabel ? ` · ${party.childAgeLabel}` : "");

  const handleClose = () => {
    if (onBack) { onBack(); return; }
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back(); return;
    }
    window.location.assign("/me/birthdays");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F6F2EA",
        color: "#141210",
        fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
        paddingBottom: 100,
      }}
    >
      <TopNav onClose={handleClose} />

      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <PageHeader
          party={party}
          performers={performers}
          dateRange={dateLabel}
          startTime={startTime}
          totalPrice={totalPrice}
        />

        {performers.length > 0 && (
          <ProgressGrid items={items} />
        )}

        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: ".14em",
              color: "rgba(20,18,16,.55)",
              whiteSpace: "nowrap",
            }}
          >
            сценарий по времени
          </span>
          <span
            style={{
              flex: 1,
              height: 1,
              background: "rgba(20,18,16,.10)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: ".14em",
              color: "rgba(20,18,16,.55)",
              whiteSpace: "nowrap",
            }}
          >
            {performers.length} исполнителей
          </span>
        </div>

        {/* Timeline */}
        <div style={{ position: "relative" }}>
          {/* Vertical line */}
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 24,
              bottom: 24,
              width: 1,
              background: "rgba(20,18,16,.10)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedItems.map((item) => {
              const isPerformer = item.type === "performer";
              const isConfirmed = item.status === "CONFIRMED";
              const isDeclined  = item.status === "DECLINED";
              const dotColor = isConfirmed
                ? "#1F8A5B"
                : isDeclined
                ? "#D85A30"
                : item.status === "PENDING"
                ? "#854F0B"
                : "rgba(20,18,16,.18)";

              return (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr",
                    alignItems: "flex-start",
                    gap: 0,
                  }}
                >
                  {/* Timeline column */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      paddingTop: 20,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 99,
                        background: isConfirmed
                          ? "#1F8A5B"
                          : isDeclined
                          ? "#D85A30"
                          : "#FAF7F1",
                        border: `2px solid ${dotColor}`,
                        boxShadow: isConfirmed
                          ? "0 0 0 4px rgba(31,138,91,.14)"
                          : isDeclined
                          ? "0 0 0 4px rgba(216,90,48,.14)"
                          : "none",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        marginTop: 6,
                        fontFamily: "var(--font-mono, ui-monospace, monospace)",
                        fontSize: 10,
                        letterSpacing: ".04em",
                        color: "rgba(20,18,16,.55)",
                        textAlign: "center",
                        lineHeight: 1.3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {firstTimePart(item.time)}
                    </span>
                  </div>

                  {/* Card */}
                  {isPerformer ? (
                    <VendorRow item={item} dateRange={dateLabel} />
                  ) : (
                    <InternalRow item={item} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Total row */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginTop: 24,
            paddingTop: 18,
            borderTop: "1px solid rgba(20,18,16,.10)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: ".14em",
              color: "rgba(20,18,16,.55)",
            }}
          >
            итого
          </span>
          <span>
            <span
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                fontSize: 36,
                letterSpacing: "-.02em",
                color: "#141210",
              }}
            >
              {totalPrice}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 13,
                color: "rgba(20,18,16,.55)",
                marginLeft: 6,
              }}
            >
              {BYN_SYMBOL}
            </span>
          </span>
        </div>
      </main>

      <Footer
        performers={performers}
        allConfirmed={allConfirmed}
        child={childDisplay}
        dateRange={dateLabel}
        startTime={startTime}
        onBack={handleClose}
      />
    </div>
  );
}
