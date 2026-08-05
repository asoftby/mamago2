import { Prisma } from "@prisma/client";
import prisma, { searchIndexer } from "@/lib/prisma";
import { syncEventHomeStories } from "@/server/stories/homeStoryItems";

/**
 * Restore soft-deleted activity.
 * Assumption: for wizard/business flows we restore to DRAFT.
 */
export async function restoreActivityToDraftById(id: string): Promise<void> {
  const affected = await prisma.$executeRaw(
    Prisma.sql`UPDATE "Activity" SET status = 'DRAFT'::"ContentStatus" WHERE id = ${id}`,
  );
  const n = typeof affected === "bigint" ? Number(affected) : Number(affected);
  if (n !== 1) {
    throw new Error(`Activity not found: ${id}`);
  }
  await searchIndexer.upsertActivity(id);
  await syncEventHomeStories(id);
}
