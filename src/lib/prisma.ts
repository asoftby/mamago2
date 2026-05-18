import { PrismaClient } from "@prisma/client";
import { SearchIndexerService } from "@/lib/search/SearchIndexerService";
import { extendPrismaWithSearchIndexing } from "@/lib/search/prismaSearchExtension";

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
  prisma: PrismaClient | undefined;
  searchIndexer: SearchIndexerService | undefined;
};

// Forced reload for Prisma schema changes - v2
const prismaBase =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

const searchIndexer = globalForPrisma.searchIndexer ?? new SearchIndexerService(prismaBase);

const prisma =
  globalForPrisma.prisma ?? extendPrismaWithSearchIndexing(prismaBase, searchIndexer);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase;
  globalForPrisma.searchIndexer = searchIndexer;
  globalForPrisma.prisma = prisma;
}

export default prisma;
export { prisma, prismaBase, searchIndexer };
