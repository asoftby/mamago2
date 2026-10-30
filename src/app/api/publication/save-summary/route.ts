import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PublicationKind = "event" | "offer" | "place";

/**
 * Aggregates unique users; public avatar images are disclosed only for users
 * with active explicit opt-in. No names, links, plan details or notes exposed.
 */
function savedQuery(kind: PublicationKind, id: string): Prisma.Sql {
  const planStatus = Prisma.sql`"cancelledAt" IS NULL AND "status" = 'CONFIRMED'`;
  switch (kind) {
    case "event":
      return Prisma.sql`
        SELECT "userId", "createdAt" FROM "Idea" WHERE "activityId" = ${id}
        UNION ALL
        SELECT "userId", "createdAt" FROM "PlanItem" WHERE "activityId" = ${id} AND ${planStatus}
      `;
    case "offer":
      return Prisma.sql`
        SELECT "userId", "createdAt" FROM "OfferIdea" WHERE "offerId" = ${id}
        UNION ALL
        SELECT "userId", "createdAt" FROM "PlanItem" WHERE "offerId" = ${id} AND ${planStatus}
      `;
    case "place":
      return Prisma.sql`
        SELECT "userId", "createdAt" FROM "PlaceIdea" WHERE "placeId" = ${id}
        UNION ALL
        SELECT "userId", "createdAt" FROM "PlanItem" WHERE "placeId" = ${id} AND ${planStatus}
      `;
  }
}

function summaryQuery(kind: PublicationKind, id: string): Prisma.Sql {
  return Prisma.sql`
    WITH saves AS (${savedQuery(kind, id)}),
    unique_savers AS (
      SELECT "userId", MAX("createdAt") AS saved_at
      FROM saves GROUP BY "userId"
    ),
    recent AS (
      SELECT u.id, u."avatarUrl", unique_savers.saved_at
      FROM unique_savers
      JOIN "PublicSaveAvatarConsent" c ON c."userId" = unique_savers."userId"
      JOIN "User" u ON u.id = unique_savers."userId"
      WHERE c."revokedAt" IS NULL AND c."textVersion" = 'save-avatar-v1'
        AND u."deletedAt" IS NULL AND u."avatarUrl" IS NOT NULL AND u."avatarUrl" <> ''
      ORDER BY unique_savers.saved_at DESC, u.id ASC
      LIMIT 5
    )
    SELECT (SELECT COUNT(*)::int FROM unique_savers) AS "count",
      COALESCE((SELECT json_agg(json_build_object(
        'avatarUrl', recent."avatarUrl"
      ) ORDER BY recent.saved_at DESC, recent.id ASC) FROM recent), '[]'::json) AS avatars
  `;
}
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");
  const id = request.nextUrl.searchParams.get("id")?.trim();

  if ((kind !== "event" && kind !== "offer" && kind !== "place") || !id || id.length > 128) {
    return NextResponse.json({ error: "Invalid publication" }, { status: 400 });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number; avatars: Array<{ avatarUrl: string }> }>>(summaryQuery(kind, id));
    return NextResponse.json(
      { count: Math.max(0, Number(rows[0]?.count ?? 0)), visibleSavers: (rows[0]?.avatars ?? []).map((a) => ({ avatarUrl: a.avatarUrl })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to load public save count:", error);
    return NextResponse.json({ error: "Unable to load save count" }, { status: 503 });
  }
}
