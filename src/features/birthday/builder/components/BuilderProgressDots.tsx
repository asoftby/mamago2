"use client";

import type { BuilderStep } from "../types/builder";

const STEPS: { key: BuilderStep; label: string }[] = [
  { key: "when", label: "Когда" },
  { key: "who", label: "Для кого" },
  { key: "format", label: "Формат" },
  { key: "pick", label: "Подбор" },
  { key: "done", label: "Готово" },
];

const STEP_ORDER = STEPS.map((s) => s.key);

export function BuilderProgressDots({ currentStep }: { currentStep: BuilderStep }) {
  const idx = Math.max(STEP_ORDER.indexOf(currentStep), 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            style={{
              width: i === idx ? 26 : 7,
              height: 7,
              borderRadius: 99,
              background:
                i === idx
                  ? "#E86A3A"
                  : i < idx
                    ? "#141210"
                    : "rgba(20,18,16,.18)",
              transition: "all .3s",
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono, ui-monospace)",
          fontSize: 11,
          color: "rgba(20,18,16,.55)",
          letterSpacing: ".08em",
        }}
      >
        {String(idx + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")} ·{" "}
        {STEPS[idx]?.label ?? ""}
      </span>
    </div>
  );
}
