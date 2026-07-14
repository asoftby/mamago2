import { NextResponse } from "next/server";
import { RouteStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { syncRouteCanonical } from "@/lib/seo/syncEntityCanonical";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const route = await prisma.route.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!route) {
    return NextResponse.json(
      { code: "ROUTE_NOT_FOUND", message: "Маршрут не найден" },
      { status: 404 },
    );
  }

  try {
    await assertContentLifecycleOperationAllowed({
      contentType: "ROUTE",
      contentId: id,
      operation: "archiveContent",
      status: route.status,
      actorRole: user.role,
      prisma,
    });

    await prisma.route.update({
      where: { id },
      data: { status: RouteStatus.ARCHIVED },
      select: { id: true },
    });
    await syncRouteCanonical(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(
        lifecycleErrorResponsePayload(error),
        { status: error.statusCode },
      );
    }
    console.error("[admin/routes archive]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Archive failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const route = await prisma.route.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!route) {
    return NextResponse.json(
      { code: "ROUTE_NOT_FOUND", message: "Маршрут не найден" },
      { status: 404 },
    );
  }

  try {
    await assertContentLifecycleOperationAllowed({
      contentType: "ROUTE",
      contentId: id,
      operation: "restoreArchived",
      status: route.status,
      actorRole: user.role,
      prisma,
    });

    await prisma.route.update({
      where: { id },
      data: { status: RouteStatus.PUBLISHED },
      select: { id: true },
    });
    await syncRouteCanonical(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(
        lifecycleErrorResponsePayload(error),
        { status: error.statusCode },
      );
    }
    console.error("[admin/routes restore]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restore failed" },
      { status: 400 },
    );
  }
}
