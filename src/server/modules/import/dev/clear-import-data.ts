/**
 * Dev-only import data cleanup utility.
 *
 * Clears: ImportReviewTask → ImportedRecord → ImportRun
 * Preserves: ImportSource, Place, Activity, everything else.
 *
 * SAFETY: throws if NODE_ENV !== "development".
 */

import prisma from "@/lib/prisma";

export interface ClearImportDataResult {
  reviewTasksDeleted: number;
  recordsDeleted: number;
  runsDeleted: number;
}

export async function clearImportDataDevOnly(): Promise<ClearImportDataResult> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      "clearImportDataDevOnly() is only available in development. " +
      `Current NODE_ENV: "${process.env.NODE_ENV}"`,
    );
  }

  // Order matters: child tables first
  const [tasks, records, runs] = await prisma.$transaction([
    prisma.importReviewTask.deleteMany({}),
    prisma.importedRecord.deleteMany({}),
    prisma.importRun.deleteMany({}),
  ]);

  return {
    reviewTasksDeleted: tasks.count,
    recordsDeleted: records.count,
    runsDeleted: runs.count,
  };
}
