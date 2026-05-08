import { ContentStatus } from "@prisma/client";
import prisma, { searchIndexer } from "@/lib/prisma";

export async function archiveActivityById(id: string): Promise<void> {
  await prisma.activity.update({
    where: { id },
    data: { status: ContentStatus.ARCHIVED },
    select: { id: true },
  });
  await searchIndexer.upsertActivity(id);
}
