import type { ParsedCapture } from "./telegramUpdateParser";

type Anchor = Pick<ParsedCapture, "anchorAt" | "anchorIsForward">;

/**
 * A full-text replacement is a new source, not a field edit of the previous
 * forwarded screenshot. Relative dates ("tomorrow") use the replacement
 * message's timestamp; ordinary field edits retain the original reference.
 */
export function resolveCaptureEditAnchor(
  original: Anchor,
  correction: Anchor,
  replacingText: boolean,
): Anchor {
  return replacingText
    ? { anchorAt: correction.anchorAt, anchorIsForward: correction.anchorIsForward }
    : { anchorAt: original.anchorAt, anchorIsForward: original.anchorIsForward };
}
