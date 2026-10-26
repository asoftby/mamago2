/**
 * Poster frame rule for event/idea cards (client-safe, no server imports).
 *
 * r = height / width of the stored image:
 * - r < POSTER_RATIO_MIN (wider than 16:9)  → crop to 16:9, anchored center;
 * - POSTER_RATIO_MIN ≤ r ≤ POSTER_RATIO_MAX → original ratio, no crop
 *   (16:9, 1:1, 4:5, A-series 1:1.41 …);
 * - r > POSTER_RATIO_MAX (taller than 2:3)  → crop to 2:3, anchored top
 *   (title/date usually live at the top of tall posters);
 * - unknown dimensions                      → 4:5, anchored top.
 *
 * No blur pads, letterboxing or fills: the frame is always either the
 * original image or an object-fit: cover crop of it.
 */
export const POSTER_RATIO_MIN = 9 / 16;
export const POSTER_RATIO_MAX = 3 / 2;
export const POSTER_RATIO_UNKNOWN = 5 / 4;

/** Frames wider than this keep the price badge away from the like button corner. */
export const POSTER_COMPACT_RATIO = 3 / 4;

export type PosterAnchor = "center" | "top";

export type PosterFrame = {
  /** height / width of the rendered frame */
  ratio: number;
  /** CSS aspect-ratio value (`width / height`) */
  aspectRatio: string;
  /** CSS object-position for object-fit: cover */
  objectPosition: "center" | "top";
  cropped: boolean;
  dimensionsKnown: boolean;
};

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function aspect(width: number, height: number): string {
  return `${width} / ${height}`;
}

export function resolvePosterFrame(
  width: number | null | undefined,
  height: number | null | undefined,
): PosterFrame {
  if (!positive(width) || !positive(height)) {
    return {
      ratio: POSTER_RATIO_UNKNOWN,
      aspectRatio: aspect(4, 5),
      objectPosition: "top",
      cropped: true,
      dimensionsKnown: false,
    };
  }

  const r = height / width;
  if (r < POSTER_RATIO_MIN) {
    return { ratio: POSTER_RATIO_MIN, aspectRatio: aspect(16, 9), objectPosition: "center", cropped: true, dimensionsKnown: true };
  }
  if (r > POSTER_RATIO_MAX) {
    return { ratio: POSTER_RATIO_MAX, aspectRatio: aspect(2, 3), objectPosition: "top", cropped: true, dimensionsKnown: true };
  }
  return {
    ratio: r,
    aspectRatio: aspect(Math.round(width), Math.round(height)),
    // Uncropped: position is irrelevant, keep center for sub-pixel rounding.
    objectPosition: "center",
    cropped: false,
    dimensionsKnown: true,
  };
}

/**
 * Low frames (16:9 on a 160px mobile column is ~90px tall) cannot fit the
 * 44px like button (top-right) and the price badge (bottom-right) in one
 * corner column; move the badge to the bottom-left there.
 */
export function posterPriceBadgeSide(frame: Pick<PosterFrame, "ratio">): "left" | "right" {
  return frame.ratio < POSTER_COMPACT_RATIO ? "left" : "right";
}
