/**
 * Изменение поста, по которому событие уже опубликовано.
 *
 * Нормализатор ставит `qualityFlags.sourceChanged` и переоткрывает задачу
 * ревью. Событие на сайте само не меняется (политика «не затирать»), поэтому
 * редактор смотрит, что поменялось, при необходимости правит событие вручную и
 * отмечает изменение просмотренным: флаг снимается, задача закрывается.
 */

import prisma from "@/lib/prisma";
import { asTelegramFlags } from "../normalizers/telegram-post.mapper";

export type AcknowledgeResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "no_change" };

export async function acknowledgeSourceChange(
  importedRecordId: string,
  reviewerUserId: string,
  now: () => Date = () => new Date(),
): Promise<AcknowledgeResult> {
  const record = await prisma.importedRecord.findUnique({
    where: { id: importedRecordId },
    select: { qualityFlags: true, reviewTask: { select: { id: true, status: true } } },
  });
  if (!record) return { ok: false, reason: "not_found" };

  const flags = asTelegramFlags(record.qualityFlags);
  if (!flags?.sourceChanged) return { ok: false, reason: "no_change" };

  const { sourceChanged: _acknowledged, ...rest } = flags;
  void _acknowledged;

  await prisma.$transaction([
    prisma.importedRecord.update({
      where: { id: importedRecordId },
      data: { qualityFlags: rest as object },
    }),
    ...(record.reviewTask && ["PENDING", "IN_PROGRESS"].includes(record.reviewTask.status)
      ? [
          prisma.importReviewTask.update({
            where: { id: record.reviewTask.id },
            data: {
              status: "COMPLETED",
              reviewerUserId,
              reviewedAt: now(),
              notes: "source change reviewed",
            },
          }),
        ]
      : []),
  ]);
  return { ok: true };
}
