import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PublicationKind = "event" | "offer" | "place";

/**
 * Only aggregate unique users are exposed. Saved plan entries and Ideas are
 * private: neither identities nor family details may be returned by this API.
 * An opt-in public identity system is a separate requirement before avatars
 * can be included in public responses.
 */
function countQuery(kind: PublicationKind, id: string): Prisma.Sql {
  const activePlan = Prisma.sql`"cancelledAt" IS NULL AND "status" = 'CONFIRMED'`;
  switch (kind) {
    case "event":
      return Prisma.sql`
        SELECT COUNT(*)::int AS "count" FROM (
          SELECT "userId" FROM "Idea" WHERE "activityId" = ${id}
          UNION
          SELECT "userId" FROM "PlanItem" WHERE "activityId" = ${id} AND ${activePlan}
        ) AS savers
      `;
    case "offer":
      return Prisma.sql`
        SELECT COUNT(*)::int AS "count" FROM (
          SELECT "userId" FROM "OfferIdea" WHERE "offerId" = ${id}
          UNION
          SELECT "userId" FROM "PlanItem" WHERE "offerId" = ${id} AND ${activePlan}
        ) AS savers
      `;
    case "place":
      return Prisma.sql`
        SELECT COUNT(*)::int AS "count" FROM (
          SELECT "userId" FROM "PlaceIdea" WHERE "placeId" = ${id}
          UNION
          SELECT "userId" FROM "PlanItem" WHERE "placeId" = ${id} AND ${activePlan}
        ) AS savers
      `;
  }
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");
  const id = request.nextUrl.searchParams.get("id")?.trim();

  if ((kind !== "event" && kind !== "offer" && kind !== "place") || !id || id.length > 128) {
    return NextResponse.json({ error: "Invalid publication" }, { status: 400 });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>(countQuery(kind, id));
    return NextResponse.json(
      { count: Math.max(0, Number(rows[0]?.count ?? 0)), visibleSavers: [] },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=30" } },
    );
  } catch (error) {
    console.error("Failed to load public save count:", error);
    return NextResponse.json({ error: "Unable to load save count" }, { status: 503 });
  }
}
