"use client";

export type PlanSentiment = "LIKE" | "NEUTRAL" | "DISLIKE";

/** Порядок и подписи как в дизайне v3: «Не очень · Хорошо · Супер». */
export const PLAN_FACES: Array<{ sentiment: PlanSentiment; mouth: "meh" | "good" | "super"; label: string }> = [
  { sentiment: "DISLIKE", mouth: "meh", label: "Не очень" },
  { sentiment: "NEUTRAL", mouth: "good", label: "Хорошо" },
  { sentiment: "LIKE", mouth: "super", label: "Супер" },
];

export const PLAN_FACE_LABEL: Record<PlanSentiment, string> = {
  DISLIKE: "Не очень",
  NEUTRAL: "Хорошо",
  LIKE: "Супер",
};

const MOUTH = {
  meh: <path d="M8.5 16c1-.8 2.2-1.2 3.5-1.2s2.5.4 3.5 1.2" />,
  good: <path d="M8.5 14.2c.9 1.1 2.1 1.7 3.5 1.7s2.6-.6 3.5-1.7" />,
  super: <path d="M7.6 13.4h8.8c-.4 2.5-2.2 4.1-4.4 4.1s-4-1.6-4.4-4.1z" />,
};

export function PlanFace({ mouth, size = 28 }: { mouth: "meh" | "good" | "super"; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9.2" />
      <circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none" />
      {MOUTH[mouth]}
    </svg>
  );
}

export function sentimentMouth(sentiment: PlanSentiment): "meh" | "good" | "super" {
  return PLAN_FACES.find((f) => f.sentiment === sentiment)!.mouth;
}
