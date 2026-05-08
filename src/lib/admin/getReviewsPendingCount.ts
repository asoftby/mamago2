import prisma from "@/lib/prisma";

/**
 * Get count of reviews pending moderation (status = PENDING)
 */
export async function getReviewsPendingCount(): Promise<number> {
  try {
    const count = await prisma.placeReview.count({
      where: {
        status: "PENDING",
      },
    });
    return count;
  } catch (error) {
    console.error("Failed to get reviews pending count:", error);
    return 0;
  }
}
