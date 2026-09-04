import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { slugifyLabelToValue } from "@/lib/slugifyLabelToValue";
import { invalidatePublicArticleLists } from "@/server/article/publicArticleCache";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

function normalizeSlug(rawSlug: unknown, rawTitle: unknown): string {
  const explicit = typeof rawSlug === "string" ? rawSlug.trim() : "";
  const fromTitle = typeof rawTitle === "string" ? rawTitle.trim() : "";
  return slugifyLabelToValue(explicit || fromTitle);
}

async function requireManager() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return null;
  }
  return user;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await requireManager();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const tag = await prisma.discoveryTag.findUnique({ where: { id } });
  if (!tag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(tag);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const user = await requireManager();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const existing = await prisma.discoveryTag.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title = body?.title !== undefined ? String(body.title).trim() : existing.title;
  const slug = body?.slug !== undefined || body?.title !== undefined
    ? normalizeSlug(body?.slug, body?.title ?? title)
    : existing.slug;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const data = {
    title,
    slug,
    description:
      body?.description === undefined ? existing.description : String(body.description ?? "").trim() || null,
    seoTitle:
      body?.seoTitle === undefined ? existing.seoTitle : String(body.seoTitle ?? "").trim() || null,
    seoDescription:
      body?.seoDescription === undefined
        ? existing.seoDescription
        : String(body.seoDescription ?? "").trim() || null,
    sortOrder:
      body?.sortOrder === undefined
        ? existing.sortOrder
        : Number.isFinite(Number(body.sortOrder))
          ? Math.floor(Number(body.sortOrder))
          : existing.sortOrder,
    isActive: body?.isActive === undefined ? existing.isActive : Boolean(body.isActive),
  };

  try {
    const updated = await prisma.discoveryTag.update({
      where: { id },
      data,
    });
    invalidatePublicArticleLists();
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Tag with this slug already exists" }, { status: 409 });
    }
    console.error("[PATCH /api/admin/discovery-tags/[id]]", error);
    return NextResponse.json({ error: "Failed to update discovery tag" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const user = await requireManager();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const disabled = await prisma.discoveryTag.update({
      where: { id },
      data: { isActive: false },
    });
    invalidatePublicArticleLists();
    return NextResponse.json({ ok: true, tag: disabled });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[DELETE /api/admin/discovery-tags/[id]]", error);
    return NextResponse.json({ error: "Failed to delete discovery tag" }, { status: 500 });
  }
}
