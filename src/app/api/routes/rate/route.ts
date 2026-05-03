import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { routeId, ratingType } = await req.json();

    if (!routeId || !ratingType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["like", "neutral", "dislike"].includes(ratingType)) {
      return NextResponse.json(
        { error: "Invalid rating type" },
        { status: 400 }
      );
    }

    // Return success with default counts (database not yet initialized)
    // In production, this would save to database and return updated counts
    return NextResponse.json({
      ok: true,
      counts: {
        like: 0,
        neutral: 0,
        dislike: 0,
      },
    });
  } catch (error) {
    console.error("Failed to rate route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
