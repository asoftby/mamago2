/**
 * DELETE /api/routes/[id]
 * Delete a route by ID.
 * Only the author can delete their own route.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Route ID is required" },
        { status: 400 },
      );
    }

    // Find the route
    const route = await prisma.route.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });

    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    // Check if user is the author
    if (route.authorId !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own routes" },
        { status: 403 },
      );
    }

    // Delete the route (cascade will delete related stops, slug history, etc.)
    await prisma.route.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, message: "Route deleted successfully" },
      { status: 200 },
    );
  } catch (err) {
    console.error("[API] DELETE /api/routes/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
