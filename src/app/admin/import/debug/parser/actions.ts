"use server";

import { getParser } from "@/server/modules/import/parsers/registry";
import { normalizePlacePayload } from "@/server/modules/import/normalizers/place.normalizer";
import { normalizeEventPayload } from "@/server/modules/import/normalizers/event.normalizer";
import { scorePlaceImport, scoreEventImport } from "@/server/modules/import/services/import-quality.service";

/** Запустить нормализацию raw payload без записи в БД. */
export async function runParserDebug(input: {
  parserKey: string;
  rawPayload?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  parsed?: unknown;
  normalized?: unknown;
  qualityScore?: number;
  warnings?: string[];
  error?: string;
}> {
  try {
    const parser = getParser(input.parserKey);
    if (!parser) {
      return { success: false, error: `Parser "${input.parserKey}" not found` };
    }

    // Если передан rawPayload — нормализуем его напрямую
    if (input.rawPayload) {
      const entityType = input.parserKey.includes("event") ? "EVENT" : "PLACE";

      if (entityType === "PLACE") {
        const { normalized, warnings } = normalizePlacePayload({
          rawPayload: input.rawPayload,
          sourceSlug: "debug",
          sourceUrl: "https://debug.local",
        });
        const { score } = scorePlaceImport(normalized);
        return { success: true, normalized, qualityScore: score, warnings };
      } else {
        const { normalized, warnings } = normalizeEventPayload({
          rawPayload: input.rawPayload,
          sourceSlug: "debug",
          sourceUrl: "https://debug.local",
        });
        const { score } = scoreEventImport(normalized);
        return { success: true, normalized, qualityScore: score, warnings };
      }
    }

    return {
      success: true,
      parsed: [],
      warnings: ["Raw payload is required; parser execution without input has been removed."],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
