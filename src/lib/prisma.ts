import { PrismaClient } from "@prisma/client";
import { SearchIndexerService } from "@/lib/search/SearchIndexerService";
import { extendPrismaWithSearchIndexing } from "@/lib/search/prismaSearchExtension";
import { extendPrismaWithPlaceGeoCells } from "@/lib/place/placeGeoCellExtension";

// Increment this version whenever the Prisma schema changes in a way
// that requires a fresh PrismaClient in the dev hot-reload cycle.
// Bump: UserEvent.familyId/planVisibility (Family Core A1, 2026-10-03)
// GSC query cache (2026-10-22).
// Wishlist models (2026-10-29).
const PRISMA_CACHE_VERSION = "v23"; // Manual booking source and idempotency

const globalForPrisma = globalThis as unknown as {
  [key: string]: unknown;
  searchIndexer: SearchIndexerService | undefined;
};

const baseKey = `prismaBase_${PRISMA_CACHE_VERSION}`;
const prismaKey = `prisma_${PRISMA_CACHE_VERSION}`;

// Forced reload for Prisma schema changes — bump PRISMA_CACHE_VERSION above.
const prismaBase =
  (globalForPrisma[baseKey] as PrismaClient | undefined) ??
  new PrismaClient({
    log: process.env.NODE_ENV === "test" && process.env.PRISMA_QUERY_EVENTS === "1"
      ? [{ level: "query", emit: "event" }]
      : process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

const searchIndexer = globalForPrisma.searchIndexer ?? new SearchIndexerService(prismaBase);

const prisma =
  (globalForPrisma[prismaKey] as PrismaClient | undefined) ??
  extendPrismaWithPlaceGeoCells(extendPrismaWithSearchIndexing(prismaBase, searchIndexer), prismaBase);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma[baseKey] = prismaBase;
  globalForPrisma.searchIndexer = searchIndexer;
  globalForPrisma[prismaKey] = prisma;
}

export default prisma;
export { prisma, prismaBase, searchIndexer };
