import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { getUserWithDetails, getUserModerationHistory } from "@/server/services/userModeration.service";
import { getUserAuditLog } from "@/server/services/auditLog.service";
import { Role } from "@prisma/client";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require ADMIN or MODERATOR role
    const user = await requireRole([Role.ADMIN, Role.MODERATOR]);

    const { id } = await context.params;

    const [details, moderationHistory, auditLog] = await Promise.all([
      getUserWithDetails(id),
      getUserModerationHistory(id),
      getUserAuditLog(id, 50),
    ]);

    return NextResponse.json({
      ...details,
      moderationHistory,
      auditLog,
    });
  } catch (error: any) {
    console.error("Error fetching user details:", error);
    
    // Handle redirect errors from requireRole
    if (error.message?.includes("NEXT_REDIRECT")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch user details" },
      { status: error.message === "User not found" ? 404 : error.message === "Insufficient permissions" ? 403 : 500 }
    );
  }
}
