"use server";

import { getParser } from "@/server/modules/import/parsers/registry";
import { normalizePlacePayload } from "@/server/modules/import/normalizers/place.normalizer";
import { normalizeEventPayload } from "@/server/modules/import/normalizers/event.normalizer";
import { scorePlaceImport, scoreEventImport } from "@/server/modules/import/services/import-quality.service";
import type { NormalizedPlaceImport, NormalizedEventImport } from "@/server/modules/import/types";

/**
 * Dev-only: запустить парсер + нормализацию без записи в БД.
 */
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

    // Иначе — запустить mock parser целиком
    const mockSource = {
      id: "debug",
      name: "Debug",
      slug: "debug",
      type: "MANUAL" as const,
      status: "ACTIVE" as const,
      baseUrl: null,
      parserKey: input.parserKey,
      fetchStrategy: "MANUAL_UPLOAD" as const,
      isTrusted: false,
      isAutoUpdate: false,
      defaultEntity: null,
      rateLimitMs: null,
      notes: null,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      cityId: null,
      isActive: true,
      archivedAt: null,
      crawlMaxPages: null,
      crawlMaxDetailLinks: null,
      crawlMaxRecords: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const parserResult = await parser.parse(mockSource);

    // Нормализуем первую запись для preview
    let normalized: NormalizedPlaceImport | NormalizedEventImport | undefined;
    let qualityScore: number | undefined;
    let warnings: string[] | undefined;

    if (parserResult.records.length > 0) {
      const first = parserResult.records[0];
      const entityType = input.parserKey.includes("event") ? "EVENT" : "PLACE";

      if (entityType === "PLACE") {
        const result = normalizePlacePayload({
          rawPayload: first.rawPayload,
          sourceSlug: "debug",
          sourceUrl: first.sourceUrl,
          externalId: first.externalId,
        });
        normalized = result.normalized;
        warnings = result.warnings;
        qualityScore = scorePlaceImport(result.normalized).score;
      } else {
        const result = normalizeEventPayload({
          rawPayload: first.rawPayload,
          sourceSlug: "debug",
          sourceUrl: first.sourceUrl,
          externalId: first.externalId,
        });
        normalized = result.normalized;
        warnings = result.warnings;
        qualityScore = scoreEventImport(result.normalized).score;
      }
    }

    return {
      success: true,
      parsed: parserResult.records,
      normalized,
      qualityScore,
      warnings,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
