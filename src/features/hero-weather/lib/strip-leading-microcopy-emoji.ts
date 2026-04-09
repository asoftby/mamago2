/**
 * Microcopy lines in pools lead with a single emoji + space; the hero UI shows a mood badge instead.
 */
export function stripLeadingMicrocopyEmoji(text: string): string {
  return text
    .trimStart()
    .replace(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D[\uFE0F\p{Extended_Pictographic}])*)+\s+/u, "");
}
