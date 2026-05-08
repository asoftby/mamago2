/**
 * Microcopy lines in pools lead with a single emoji + space; the hero UI shows a mood badge instead.
 */
export function stripLeadingMicrocopyEmoji(text: string): string {
  const trimmed = text.trimStart();

  // Avoid newer Unicode property escapes here: older iOS Safari builds can choke on them.
  // We strip a leading emoji/pictograph cluster conservatively and fall back to the original text.
  const stripped = trimmed
    .replace(/^(?:[\u2600-\u27BF]|\uFE0F|\u200D|[\uD83C-\uDBFF][\uDC00-\uDFFF])+\s*/u, "")
    .trimStart();

  return stripped || trimmed;
}
