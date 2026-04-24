import { prismaBase } from "@/lib/prisma";

export async function getImportPendingReviewCount(): Promise<number> {
  try {
    const db = prismaBase as unknown as {
      importedRecord?: {
        count: (args: { where: { reviewStatus: string } }) => Promise<number>;
      };
    };

    if (!db.importedRecord) {
      return 0;
    }

    return await db.importedRecord.count({
      where: {
        reviewStatus: "PENDING",
      },
    });
  } catch (e) {
    console.error("getImportPendingReviewCount failed:", e);
    return 0;
  }
}
