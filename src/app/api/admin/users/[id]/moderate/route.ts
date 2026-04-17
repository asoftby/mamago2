import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import {
  warnUser,
  limitUser,
  suspendUser,
  banUser,
  unbanUser,
  changeUserRole,
} from "@/server/services/userModeration.service";
import { Role, UserModerationActionType } from "@prisma/client";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require ADMIN or MODERATOR role
    const moderator = await requireRole([Role.ADMIN, Role.MODERATOR]);

    const { id: userId } = await context.params;
    const body = await req.json();

    const { action, reason, note, expiresAt, newRole } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 }
      );
    }

    let result;

    switch (action as UserModerationActionType) {
      case UserModerationActionType.WARN:
        result = await warnUser({
          userId,
          reason,
          note,
          moderatorId: moderator.id,
        });
        break;

      case UserModerationActionType.LIMIT:
        result = await limitUser({
          userId,
          reason,
          note,
          moderatorId: moderator.id,
        });
        break;

      case UserModerationActionType.SUSPEND:
        if (!expiresAt) {
          return NextResponse.json(
            { error: "expiresAt is required for SUSPEND action" },
            { status: 400 }
          );
        }
        result = await suspendUser({
          userId,
          reason,
          note,
          expiresAt: new Date(expiresAt),
          moderatorId: moderator.id,
        });
        break;

      case UserModerationActionType.BAN:
        result = await banUser({
          userId,
          reason,
          note,
          moderatorId: moderator.id,
        });
        break;

      case UserModerationActionType.UNBAN:
        result = await unbanUser({
          userId,
          reason,
          note,
          moderatorId: moderator.id,
        });
        break;

      case UserModerationActionType.ROLE_CHANGE:
        if (!newRole) {
          return NextResponse.json(
            { error: "newRole is required for ROLE_CHANGE action" },
            { status: 400 }
          );
        }
        result = await changeUserRole({
          userId,
          newRole: newRole as Role,
          reason,
          note,
          moderatorId: moderator.id,
        });
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action type" },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error performing moderation action:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Handle redirect errors from requireRole
    if (errorMessage.includes("NEXT_REDIRECT")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage || "Failed to perform moderation action" },
      { status: errorMessage === "User not found" ? 404 : errorMessage === "Insufficient permissions" ? 403 : 500 }
    );
  }
}
