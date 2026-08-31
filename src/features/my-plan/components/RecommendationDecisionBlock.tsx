"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationDecisionBlockProps = {
  onDecide: () => void;
  onCatalog: () => void;
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
  isGenerating = false,
  compact = false,
}: RecommendationDecisionBlockProps) {
  return (
    <section className={cn("space-y-3", compact && "space-y-2")} aria-label="Выбор действия" style={{ padding: compact ? "4px 4px 0" : "8px 4px 0" }}>
      <button
        type="button"
        onClick={onDecide}
        disabled={isGenerating}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          width: "100%",
          height: 52,
          borderRadius: 999,
          background: "#E86A3A",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          border: 0,
          cursor: isGenerating ? "default" : "pointer",
          transition: "background .18s",
        }}
        onMouseEnter={(e) => {
          if (!isGenerating) (e.currentTarget as HTMLButtonElement).style.background = "#C24E22";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#E86A3A";
        }}
      >
        {isGenerating ? <RefreshCw className="h-[17px] w-[17px] animate-spin" /> : <Sparkles className="h-[17px] w-[17px]" />}
        Подобрать за пару секунд
      </button>

      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={onCatalog}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 14,
            fontWeight: 600,
            color: "#3A332B",
            background: "none",
            border: 0,
            cursor: "pointer",
            transition: "gap .15s, color .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.gap = "11px";
            (e.currentTarget as HTMLButtonElement).style.color = "#C24E22";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.gap = "7px";
            (e.currentTarget as HTMLButtonElement).style.color = "#3A332B";
          }}
        >
          Выбрать самой <ArrowIcon />
        </button>
      </div>
    </section>
  );
}
