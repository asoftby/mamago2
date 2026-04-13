import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { searchUsers } from "@/server/services/userModeration.service";
import { Role, UserStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    // Require ADMIN or MODERATOR role
    await requireRole([Role.ADMIN, Role.MODERATOR]);

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const role = searchParams.get("role") as Role | undefined;
    const status = searchParams.get("status") as UserStatus | undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await searchUsers(query, {
      role,
      status,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error fetching users:", error);
    
    // Handle redirect errors from requireRole
    if (error instanceof Error && error.message?.includes("NEXT_REDIRECT")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch users",
      },
      {
        status:
          error instanceof Error && error.message === "Insufficient permissions"
            ? 403
            : 500,
      }
    );
  }
}
