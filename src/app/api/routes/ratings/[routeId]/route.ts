import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { routeId: string } }
) {
  try {
    const { routeId } = params;

    if (!routeId) {
      return NextResponse.json(
        { error: "Missing routeId" },
        { status: 400 }
      );
    }

    // Return default counts (database not yet initialized)
    // In production, this would query the database
    return NextResponse.json({
      like: 0,
      neutral: 0,
      dislike: 0,
    });
  } catch (error) {
    console.error("Failed to get route ratings:", error);
    return NextResponse.json(
      { like: 0, neutral: 0, dislike: 0 },
      { status: 200 }
    );
  }
}
