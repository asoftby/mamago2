import { NextRequest, NextResponse } from "next/server";
import { RouteStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { syncRouteCanonical } from "@/lib/seo/syncEntityCanonical";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { publish?: boolean };

  const route = await prisma.route.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      _count: { select: { stops: true } },
    },
  });

  if (!route) {
    return NextResponse.json(
      { code: "ROUTE_NOT_FOUND", message: "Маршрут не найден" },
      { status: 404 },
    );
  }

  if (body.publish === true && route._count.stops < 2) {
    return NextResponse.json(
      {
        code: "ROUTE_PUBLISH_REQUIRES_STOPS",
        message: "Для публикации маршрута нужно минимум две остановки.",
      },
      { status: 400 },
    );
  }

  const nextStatus =
    body.publish === true
      ? RouteStatus.PUBLISHED
      : body.publish === false
        ? RouteStatus.DRAFT
        : null;

  if (!nextStatus) {
    return NextResponse.json(
      { code: "ROUTE_ACTION_REQUIRED", message: "Не указано действие для маршрута" },
      { status: 400 },
    );
  }

  await prisma.route.update({
    where: { id },
    data:
      nextStatus === RouteStatus.PUBLISHED
        ? { status: nextStatus, visibility: "PUBLIC" }
        : { status: nextStatus },
    select: { id: true },
  });

  await syncRouteCanonical(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
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
      operation: route.status === RouteStatus.ARCHIVED ? "deleteArchived" : "deleteDraft",
      status: route.status,
      actorRole: user.role,
      prisma,
    });

    await prisma.route.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(
        lifecycleErrorResponsePayload(error),
        { status: error.statusCode },
      );
    }
    console.error("[admin/routes DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 400 },
    );
  }
}
