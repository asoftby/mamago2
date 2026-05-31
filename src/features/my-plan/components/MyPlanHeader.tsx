"use client";

type MyPlanHeaderProps = {
  onClose?: () => void;
  compact?: boolean;
};

export function MyPlanHeader({ onClose, compact = false }: MyPlanHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: compact ? "18px 20px 14px" : "22px 24px 18px",
        borderBottom: "1px solid rgba(20,18,16,.10)",
        background: "#FAF7F1",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-sans)",
          fontSize: 24,
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "-.05em",
          color: "#141210",
        }}
      >
        Мой <em style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "#C24E22" }}>план</em>
      </h2>

      <button
        type="button"
        aria-label="Закрыть мой план"
        onClick={() => onClose?.()}
        style={{
          width: 36,
          height: 36,
          borderRadius: 99,
          background: "transparent",
          border: "1px solid rgba(20,18,16,.18)",
          color: "rgba(20,18,16,.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all .15s",
          flexShrink: 0,
          fontSize: 13,
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget;
          b.style.background = "#141210";
          b.style.color = "#FAF7F1";
          b.style.borderColor = "#141210";
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget;
          b.style.background = "transparent";
          b.style.color = "rgba(20,18,16,.55)";
          b.style.borderColor = "rgba(20,18,16,.18)";
        }}
      >
        ✕
      </button>
    </div>
  );
}
