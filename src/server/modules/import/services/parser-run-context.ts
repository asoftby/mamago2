import prisma from "@/lib/prisma";
import type { KnownPostImage, ParserRunContext } from "../types";

/**
 * Контекст запуска для парсеров. Сейчас даёт одно: картинки постов, которые
 * уже сохранены у записей этого источника, чтобы парсер не скачивал их заново
 * и брал сохранённый `sha256`. Только чтение.
 */
export function buildParserRunContext(sourceId: string): ParserRunContext {
  return {
    async loadKnownImages(externalIds) {
      const result = new Map<string, KnownPostImage[]>();
      if (externalIds.length === 0) return result;
      const rows = await prisma.importedRecord.findMany({
        where: { sourceId, externalId: { in: externalIds } },
        select: { externalId: true, rawPayload: true },
      });
      for (const row of rows) {
        if (!row.externalId) continue;
        const images = (row.rawPayload as { images?: unknown } | null)?.images;
        if (!Array.isArray(images)) continue;
        const known = images.flatMap((image): KnownPostImage[] => {
          const candidate = image as { url?: unknown; sha256?: unknown };
          return typeof candidate?.url === "string" && typeof candidate?.sha256 === "string"
            ? [{ url: candidate.url, sha256: candidate.sha256 }]
            : [];
        });
        if (known.length > 0) result.set(row.externalId, known);
      }
      return result;
    },
  };
}
