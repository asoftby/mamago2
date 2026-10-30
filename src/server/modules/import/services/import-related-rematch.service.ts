/**
 * «Это одно событие»: после публикации записи переоцениваем связанные
 * ожидающие записи других источников.
 *
 * Пост канала и запись ABWS о том же событии могут ждать ревью одновременно.
 * Пока ни одна не опубликована, в каталоге кандидата нет. Как только одну
 * опубликовали, у второй появляется кандидат `Activity`: ей достаточно заново
 * пройти матчинг, и редактор увидит привычные «Обновить» и «Объединить» с
 * этим событием. Нового вида решения и автоматического слияния нет.
 */

import prisma from "@/lib/prisma";
import { asTelegramFlags } from "../normalizers/telegram-post.mapper";
import { matchRecord } from "./import-matching.service";

/** Сколько связанных записей переоцениваем за одну публикацию. */
export const REMATCH_LIMIT = 20;

export interface RematchDeps {
  matchRecord: (recordId: string) => Promise<unknown>;
}

export async function rematchRelatedPendingRecords(
  publishedRecordId: string,
  deps: RematchDeps = { matchRecord },
): Promise<{ rematched: string[]; failed: string[] }> {
  const published = await prisma.importedRecord.findUnique({
    where: { id: publishedRecordId },
    select: { qualityFlags: true },
  });

  // Записи, которые опубликованная указывала как возможные дубли...
  const listedByPublished = (asTelegramFlags(published?.qualityFlags)?.pendingDuplicates ?? []).map((d) => d.recordId);
  // ...и записи, которые указывали на неё.
  const listingPublished = await prisma.importedRecord.findMany({
    where: { qualityFlags: { path: ["pendingDuplicates"], array_contains: [{ recordId: publishedRecordId }] } },
    select: { id: true },
    take: REMATCH_LIMIT,
  });

  const candidateIds = [...new Set([...listedByPublished, ...listingPublished.map((r) => r.id)])]
    .filter((id) => id !== publishedRecordId)
    .slice(0, REMATCH_LIMIT);
  if (candidateIds.length === 0) return { rematched: [], failed: [] };

  // Только то, что ещё ждёт решения: чужие решения и опубликованное не трогаем.
  const pending = await prisma.importedRecord.findMany({
    where: {
      id: { in: candidateIds },
      reviewStatus: { in: ["PENDING", "IN_REVIEW"] },
      publishedActivityId: null,
      publishedPlaceId: null,
      normalizeStatus: "SUCCESS",
    },
    select: { id: true },
  });

  const rematched: string[] = [];
  const failed: string[] = [];
  for (const { id } of pending) {
    try {
      await deps.matchRecord(id);
      rematched.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { rematched, failed };
}
