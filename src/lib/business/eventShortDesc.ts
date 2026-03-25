import { createExcerpt } from "@/lib/richtext/utils";

const FALLBACK_MIN = "Событие для семей"; // 18 chars — всегда ≥ 10

/**
 * Краткое описание для карточки и модерации: из полного описания / названия,
 * с гарантией минимум 10 символов (требование API).
 */
export function computeEventShortDesc(input: {
  title: string;
  fullDescriptionHtml: string;
}): string {
  const titleTrim = input.title?.trim() ?? "";
  const excerptFromDescription = createExcerpt(input.fullDescriptionHtml ?? "", 220);

  let shortDesc =
    excerptFromDescription.trim().length >= 10
      ? excerptFromDescription
      : titleTrim.length >= 10
        ? titleTrim.slice(0, 240)
        : [titleTrim, excerptFromDescription].filter(Boolean).join(" ").trim().slice(0, 240) ||
          "";

  if (shortDesc.trim().length < 10) {
    shortDesc =
      titleTrim.length > 0
        ? `${titleTrim.slice(0, 200)} — событие`.slice(0, 240)
        : FALLBACK_MIN;
  }
  if (shortDesc.trim().length < 10) {
    shortDesc = FALLBACK_MIN;
  }

  return shortDesc.replace(/\s+/g, " ").trim().slice(0, 500);
}
