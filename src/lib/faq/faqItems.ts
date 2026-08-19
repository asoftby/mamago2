import { randomUUID } from "crypto";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  position: number;
};

const MAX_FAQ_ITEMS = 10;

function makeFaqId() {
  return randomUUID();
}

export function normalizeFaqItems(input: unknown): FaqItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .slice()
    .sort((left, right) => {
      const leftRaw = left && typeof left === "object" ? (left as Record<string, unknown>) : {};
      const rightRaw = right && typeof right === "object" ? (right as Record<string, unknown>) : {};
      const leftPosition = typeof leftRaw.position === "number" && Number.isFinite(leftRaw.position)
        ? leftRaw.position
        : Number.POSITIVE_INFINITY;
      const rightPosition = typeof rightRaw.position === "number" && Number.isFinite(rightRaw.position)
        ? rightRaw.position
        : Number.POSITIVE_INFINITY;

      return leftPosition - rightPosition;
    })
    .slice(0, MAX_FAQ_ITEMS)
    .map((item) => {
      const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const question = typeof raw.question === "string" ? raw.question.trim() : "";
      const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";

      if (!question && !answer) return null;
      if (!question || !answer) return null;

      return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : makeFaqId(),
        question,
        answer,
        position: 0,
      } satisfies FaqItem;
    })
    .filter((item): item is FaqItem => item !== null)
    .map((item, index) => ({
      ...item,
      position: index,
    }));
}

export function hasFaqItems(input: unknown): boolean {
  return normalizeFaqItems(input).length > 0;
}
