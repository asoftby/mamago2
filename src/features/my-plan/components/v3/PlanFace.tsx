"use client";

import {
  EMOJI_RATING_OPTIONS,
  type EmojiRatingType,
} from "@/lib/content-rating/emojiRating";

export type PlanSentiment = "LIKE" | "NEUTRAL" | "DISLIKE";

type PlanMouth = "meh" | "good" | "super";

/** Maps plan mouth keys → shared article/review emoji rating types. */
const MOUTH_TO_EMOJI_TYPE: Record<PlanMouth, EmojiRatingType> = {
  meh: "dislike",
  good: "neutral",
  super: "like",
};

const EMOJI_BY_TYPE = Object.fromEntries(
  EMOJI_RATING_OPTIONS.map((option) => [option.type, option.emoji]),
) as Record<EmojiRatingType, string>;

/** Порядок и подписи как в дизайне v3: «Не очень · Хорошо · Супер». */
export const PLAN_FACES: Array<{
  sentiment: PlanSentiment;
  mouth: PlanMouth;
  label: string;
  emoji: string;
}> = [
  { sentiment: "DISLIKE", mouth: "meh", label: "Не очень", emoji: EMOJI_BY_TYPE.dislike },
  { sentiment: "NEUTRAL", mouth: "good", label: "Хорошо", emoji: EMOJI_BY_TYPE.neutral },
  { sentiment: "LIKE", mouth: "super", label: "Супер", emoji: EMOJI_BY_TYPE.like },
];

export const PLAN_FACE_LABEL: Record<PlanSentiment, string> = {
  DISLIKE: "Не очень",
  NEUTRAL: "Хорошо",
  LIKE: "Супер",
};

export function PlanFace({ mouth, size = 28 }: { mouth: PlanMouth; size?: number }) {
  const emoji = EMOJI_BY_TYPE[MOUTH_TO_EMOJI_TYPE[mouth]];
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center leading-none select-none"
      style={{ fontSize: size, width: size, height: size }}
    >
      {emoji}
    </span>
  );
}

export function sentimentMouth(sentiment: PlanSentiment): PlanMouth {
  return PLAN_FACES.find((f) => f.sentiment === sentiment)!.mouth;
}
