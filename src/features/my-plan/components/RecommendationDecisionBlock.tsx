"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationDecisionBlockProps = {
  onDecide: () => void;
  isGenerating?: boolean;
  compact?: boolean;
};

export function RecommendationDecisionBlock({
  onDecide,
  isGenerating = false,
  compact = false,
}: RecommendationDecisionBlockProps) {
  return (
    <section
      className={cn(compact ? "px-1 pt-1" : "px-1 pt-2")}
      aria-label="Подбор рекомендаций"
    >
      <div
        className="rounded-full p-px"
        style={{
          background:
            "linear-gradient(120deg, rgba(232,106,58,.58), rgba(239,135,89,.38), rgba(202,139,255,.34), rgba(112,183,255,.34), rgba(118,205,166,.32), rgba(232,106,58,.58))",
          backgroundSize: "220% 220%",
          animation: "myPlanRainbowBorder 8s ease-in-out infinite",
          boxShadow: "0 8px 24px rgba(20,18,16,.05)",
        }}
      >
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
            height: compact ? 50 : 52,
            borderRadius: 999,
            background: "#FAF7F1",
            color: "#3A332B",
            fontSize: 15,
            fontWeight: 600,
            border: 0,
            cursor: isGenerating ? "default" : "pointer",
            transition: "background .18s, transform .18s",
          }}
          onMouseEnter={(event) => {
            if (!isGenerating) {
              event.currentTarget.style.background = "#F6F1E8";
            }
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "#FAF7F1";
          }}
        >
          {isGenerating ? (
            <RefreshCw className="h-[17px] w-[17px] animate-spin text-primary" />
          ) : (
            <Sparkles className="h-[17px] w-[17px] text-primary" />
          )}
          Подобрать за пару секунд
        </button>
      </div>

      <style jsx>{`
        @keyframes myPlanRainbowBorder {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  );
}
