import prisma from "@/lib/prisma";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";

/** Дублирует логику pickImportEventPosterUrl (import mapper) — без зависимости lib → server. */
function posterUrlFromNormalizedEvent(o: Record<string, unknown>): string | undefined {
  const main =
    typeof o.mainImageUrl === "string" && o.mainImageUrl.trim() ? o.mainImageUrl.trim() : "";
  const urls = Array.isArray(o.imageUrls)
    ? o.imageUrls.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
  for (const u of [main, ...urls].filter(Boolean)) {
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("//")) return `https:${u}`;
  }
  return undefined;
}

/**
 * Для событий без обложки в Activity — URL постера из нормализованного импорта
 * (пока пользователь не загрузил файл в медиатеку).
 */
export async function loadImportPosterFallbacksForActivities(
  activityIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (activityIds.length === 0) return out;

  const rows = await prisma.importedRecord.findMany({
    where: { publishedActivityId: { in: activityIds } },
    select: { publishedActivityId: true, normalizedData: true },
  });

  for (const r of rows) {
    if (!r.publishedActivityId) continue;
    const raw = r.normalizedData;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    if (o.entityType !== "EVENT") continue;

    const url = posterUrlFromNormalizedEvent(o);
    if (url) out.set(r.publishedActivityId, url);
  }

  return out;
}

/**
 * Обложка активности: галерея / coverImageUrl, иначе постер из импорта (ImportedRecord).
 */
export async function resolveActivityCoverUrlWithImportFallback(
  activityId: string,
  input: {
    coverImageId: string | null;
    coverImageUrl: string | null;
    images: Array<{ id: string; url: string }>;
  },
): Promise<string | null> {
  const direct = resolveActivityCoverUrl(input);
  if (direct) return direct;
  const map = await loadImportPosterFallbacksForActivities([activityId]);
  return map.get(activityId) ?? null;
}
