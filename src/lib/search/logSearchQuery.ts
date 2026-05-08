import prisma from "@/lib/prisma";

interface LogSearchQueryParams {
  query: string;
  resultsCount: number;
  clickedEntityId?: string;
  clickedEntityType?: string;
  cityId?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Log a search query for analytics and zero-result tracking
 * This is a fire-and-forget operation - errors are logged but don't affect the search
 */
export async function logSearchQuery(params: LogSearchQueryParams): Promise<void> {
  try {
    await prisma.searchQueryLog.create({
      data: {
        query: params.query.trim().toLowerCase(),
        resultsCount: params.resultsCount,
        clickedEntityId: params.clickedEntityId,
        clickedEntityType: params.clickedEntityType,
        cityId: params.cityId,
        userId: params.userId,
        sessionId: params.sessionId,
      },
    });
  } catch (error) {
    // Log error but don't throw - search logging should never break search
    console.error("Failed to log search query:", error);
  }
}

/**
 * Log a click on a search result
 * Updates the existing log entry with click information
 */
export async function logSearchClick(params: {
  query: string;
  entityId: string;
  entityType: string;
  userId?: string;
  sessionId?: string;
}): Promise<void> {
  try {
    // Find the most recent search log for this query/user/session
    const recentLog = await prisma.searchQueryLog.findFirst({
      where: {
        query: params.query.trim().toLowerCase(),
        userId: params.userId,
        sessionId: params.sessionId,
        clickedEntityId: null, // Not yet clicked
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentLog) {
      await prisma.searchQueryLog.update({
        where: { id: recentLog.id },
        data: {
          clickedEntityId: params.entityId,
          clickedEntityType: params.entityType,
        },
      });
    }
  } catch (error) {
    console.error("Failed to log search click:", error);
  }
}
