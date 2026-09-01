/**
 * DELETE /api/business/places/[id]/delete
 * Delete a draft place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { detachImportedRecordsForCatalogEntity } from "@/server/modules/import/services/import-link-reconciliation.service";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const place = await prisma.place.findUnique({
      where: { id },
      select: { createdByUserId: true, ownerBusinessId: true, status: true },
    });
    if (!place) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Place not found" },
        { status: 404 },
      );
    }

    if (!(await canManagePlaceAsync(user, place))) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have access to this place" },
        { status: 403 },
      );
    }

    await assertContentLifecycleOperationAllowed({
      contentType: "PLACE",
      contentId: id,
      operation: "deleteDraft",
      status: place.status,
      prisma,
    });

    await detachImportedRecordsForCatalogEntity(
      {
        entityType: "PLACE",
        entityId: id,
        reason: "Связанный Place был удалён и больше не считается активной сущностью каталога.",
      },
      prisma,
    );
    await prisma.place.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(lifecycleErrorResponsePayload(error), {
        status: error.statusCode,
      });
    }
    console.error("[place-delete] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      { status: 500 },
    );
  }
}
