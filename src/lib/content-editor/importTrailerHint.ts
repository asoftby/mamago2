/**
 * Подсказка трейлера из нормализованного или raw импорта события.
 */

export type EventImportTrailerHint = {
  trailerUrl: string;
};

const TRAILER_KEYS = [
  "trailerUrl",
  "trailer_url",
  "trailer",
  "videoUrl",
  "video_url",
  "reelsUrl",
];

export function parseEventImportTrailerHint(raw: unknown): EventImportTrailerHint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  for (const key of TRAILER_KEYS) {
    const val = o[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return { trailerUrl: val.trim() };
    }
  }

  return null;
}
