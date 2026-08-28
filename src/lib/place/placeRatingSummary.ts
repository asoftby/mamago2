import "server-only";

import prisma from "@/lib/prisma";

/**
 * Combines mamaGo-native review stats with the Google fallback stored on Place.
 * Mirrors the weighting used by the public place page (`combineAverageRatings`
 * in `src/app/(public)/[city]/places/[slug]/page.tsx`) without pulling in that
 * page's full review-list machinery — this only needs an average + count.
 */
export function combinePlaceRatingSummary(input: {
  mamagoAverage: number | null;
  mamagoCount: number;
  googleRating: number | null;
  googleUserRatingsTotal: number | null;
}): { value: number; count: number } | null {
  const hasGoogle =
    input.googleRating != null &&
    input.googleUserRatingsTotal != null &&
    input.googleUserRatingsTotal > 0;

  if (!hasGoogle) {
    if (input.mamagoAverage == null || input.mamagoCount <= 0) return null;
    return { value: input.mamagoAverage, count: input.mamagoCount };
  }

  const weightedMamago =
    input.mamagoAverage != null ? input.mamagoAverage * input.mamagoCount : 0;
  const totalCount = input.mamagoCount + (input.googleUserRatingsTotal ?? 0);
  if (totalCount === 0) return null;

  const value =
    (weightedMamago +
      (input.googleRating ?? 0) * (input.googleUserRatingsTotal ?? 0)) /
    totalCount;
  return { value, count: totalCount };
}

/** Published-review aggregate + Google fallback for one place, by id. */
export async function getPlaceRatingSummary(
  placeId: string,
  google: { googleRating: number | null; googleUserRatingsTotal: number | null },
): Promise<{ value: number; count: number } | null> {
  const [stats, persistedGoogleReview] = await Promise.all([
    prisma.placeReview.aggregate({
      where: { placeId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.placeReview.findFirst({
      where: { placeId, status: "PUBLISHED", source: "GOOGLE" },
      select: { id: true },
    }),
  ]);

  const hasPersistedGoogleReviews = persistedGoogleReview != null;

  return combinePlaceRatingSummary({
    mamagoAverage: stats._avg.rating,
    mamagoCount: stats._count,
    googleRating: hasPersistedGoogleReviews ? null : google.googleRating,
    googleUserRatingsTotal: hasPersistedGoogleReviews
      ? null
      : google.googleUserRatingsTotal,
  });
}
