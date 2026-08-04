"use client";

import { RefreshCw, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationDecisionBlockProps = {
  onDecide: () => void;
  onCatalog: () => void;
  onIdeas: () => void;
  ideasCount?: number;
  isGenerating?: boolean;
  compact?: boolean;
};

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);

export function RecommendationDecisionBlock({
  onDecide,
  onCatalog,
  onIdeas,
  isGenerating = false,
  compact = false,
}: RecommendationDecisionBlockProps) {
  return (
    <section className={cn("space-y-3", compact && "space-y-2")} aria-label="Выбор действия">
      {/* Two choice cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compact ? 8 : 12 }}>

        {/* Card 1 — Реши за меня (accent) */}
        <button
          type="button"
          onClick={onDecide}
          style={{
            position: "relative",
            overflow: "hidden",
            padding: compact ? "18px 16px 16px" : "22px 20px 20px",
            background: "linear-gradient(160deg, #FFE8DC, #FFF1E5)",
            border: "1px solid rgba(232,106,58,.28)",
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 12,
            textAlign: "left",
            cursor: "pointer",
            transition: "all .22s",
            minHeight: compact ? 140 : 160,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 36px -18px rgba(232,106,58,.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "none";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          {/* Decoration glow */}
          <span style={{
            position: "absolute", top: -28, right: -28, width: 110, height: 110, borderRadius: 99,
            background: "radial-gradient(circle, rgba(232,106,58,.22), transparent 65%)",
            pointerEvents: "none",
          }} />

          {/* Icon */}
          <span style={{
            width: 40, height: 40, borderRadius: 99,
            background: "#fff",
            color: "#C24E22",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(232,106,58,.18)",
            position: "relative", zIndex: 1,
            flexShrink: 0,
          }}>
            {isGenerating
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Sparkles className="h-4 w-4" />}
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, position: "relative", zIndex: 1 }}>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: ".12em", color: "#C24E22", display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C24E22", flexShrink: 0 }} />
              быстро
            </span>
            <span
              style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 400, lineHeight: 1.2, color: "#141210" }}
            >
              Реши за меня
            </span>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: "#3A332B" }}>
              Подберём идеи за пару секунд
            </span>
          </div>

          <span style={{
            marginTop: "auto",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600,
            color: "#C24E22",
            position: "relative", zIndex: 1,
          }}>
            Выбрать <ArrowIcon />
          </span>
        </button>

        {/* Card 2 — Сама решу (plain) */}
        <button
          type="button"
          onClick={onCatalog}
          style={{
            padding: compact ? "18px 16px 16px" : "22px 20px 20px",
            background: "#FAF7F1",
            border: "1px solid rgba(20,18,16,.10)",
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 12,
            textAlign: "left",
            cursor: "pointer",
            transition: "all .22s",
            minHeight: compact ? 140 : 160,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 36px -18px rgba(20,18,16,.18)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(20,18,16,.28)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "none";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(20,18,16,.10)";
          }}
        >
          {/* Icon */}
          <span style={{
            width: 40, height: 40, borderRadius: 99,
            background: "#F6F2EA",
            color: "#3A332B",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(20,18,16,.10)",
            flexShrink: 0,
          }}>
            <BookOpen className="h-4 w-4" />
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: ".12em", color: "rgba(20,18,16,.55)", display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(20,18,16,.45)", flexShrink: 0 }} />
              самостоятельно
            </span>
            <span
              style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 400, lineHeight: 1.2, color: "#141210" }}
            >
              Сама решу
            </span>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: "rgba(20,18,16,.55)" }}>
              Иду в каталог и выбираю под настроение
            </span>
          </div>

          <span style={{
            marginTop: "auto",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600,
            color: "#141210",
          }}>
            Выбрать <ArrowIcon />
          </span>
        </button>
      </div>

      {/* Footer link */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={onIdeas}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600,
            color: "#C24E22",
            background: "none", border: "none", cursor: "pointer",
            transition: "gap .18s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.gap = "10px"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.gap = "6px"; }}
        >
          Мои идеи <ArrowIcon />
        </button>
      </div>
    </section>
  );
}
