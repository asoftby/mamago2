import type { PrismaClient } from "@prisma/client";

/** Numbers the parts of an item 0..n-1 in telegramMessageId order (album order). */
export async function numberInboxParts(
  db: Pick<PrismaClient, "inboxItemPart" | "$transaction">,
  inboxItemId: string,
): Promise<void> {
  const parts = await db.inboxItemPart.findMany({
    where: { inboxItemId },
    orderBy: { telegramMessageId: "asc" },
    select: { id: true },
  });
  await db.$transaction(
    parts.map((part, index) => db.inboxItemPart.update({ where: { id: part.id }, data: { position: index } })),
  );
}
