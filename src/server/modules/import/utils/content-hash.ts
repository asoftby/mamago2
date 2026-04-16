import { createHash } from "crypto";

/**
 * Вычисляет стабильный SHA-256 hash от нормализованного JSON-контента.
 * Используется для дедупликации ImportedRecord по содержимому.
 */
export function computeContentHash(content: unknown): string {
  const normalized = JSON.stringify(content, Object.keys(content as object).sort());
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
