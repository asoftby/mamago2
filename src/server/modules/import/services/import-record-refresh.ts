import prisma from "@/lib/prisma";

/**
 * Запись с тем же `contentHash` пайплайн пропускает без записи. Но у источников,
 * которые считают хэш от `hashInput` (Telegram), в `rawPayload` есть данные вне
 * хэша: адреса картинок CDN. Если они сменились, их нужно сохранить, иначе
 * следующий запуск снова скачает те же картинки по новым адресам.
 *
 * Обновляется только `rawPayload`: статусы разбора, нормализации и матчинга,
 * ревью-задача и черновики не затрагиваются.
 */
export async function refreshUnchangedRecordPayload(
  recordId: string,
  nextPayload: Record<string, unknown>,
): Promise<boolean> {
  const current = await prisma.importedRecord.findUnique({
    where: { id: recordId },
    select: { rawPayload: true },
  });
  if (!current) return false;
  if (JSON.stringify(current.rawPayload) === JSON.stringify(nextPayload)) return false;

  await prisma.importedRecord.update({
    where: { id: recordId },
    data: { rawPayload: nextPayload as object },
    select: { id: true },
  });
  return true;
}
