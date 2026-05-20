import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import {
  isFilterType,
  isFilterUi,
  isCompatibleTypeUi,
  getCompatibleUis,
} from "@/lib/discovery/filterDefinitionTypes";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const filter = await prisma.filterDefinition.findUnique({
    where: { id },
    include: {
      options: { orderBy: [{ orderIndex: "asc" }, { value: "asc" }] },
    },
  });
  if (!filter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(filter);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, slug, type, ui, order, isActive, placement, orderIndex, showTitle } = body;

    if (type !== undefined && !isFilterType(String(type))) {
      return NextResponse.json(
        { error: `Invalid type "${type}". Allowed: single, multiple, boolean, range` },
        { status: 422 },
      );
    }
    if (ui !== undefined && !isFilterUi(String(ui))) {
      return NextResponse.json(
        {
          error: `Invalid ui "${ui}". Allowed: chips, tabs, toggle, switcher, range, checkboxes, select, multiselect`,
        },
        { status: 422 },
      );
    }
    if (type !== undefined && ui !== undefined) {
      const resolvedType = String(type);
      const resolvedUi = String(ui);
      if (isFilterType(resolvedType) && isFilterUi(resolvedUi) && !isCompatibleTypeUi(resolvedType, resolvedUi)) {
        return NextResponse.json(
          {
            error: `Incompatible type+ui: type="${resolvedType}" does not support ui="${resolvedUi}". Allowed: ${getCompatibleUis(resolvedType).join(", ")}`,
          },
          { status: 422 },
        );
      }
    }

    const filter = await prisma.filterDefinition.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(slug !== undefined && { slug }),
        ...(type !== undefined && { type }),
        ...(ui !== undefined && { ui }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
        ...(placement !== undefined && { placement }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(showTitle !== undefined && { showTitle: Boolean(showTitle) }),
      },
    });

    return NextResponse.json(filter);
  } catch (error) {
    return NextResponse.json({ error: "Error updating filter" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.filterDefinition.delete({ where: { id } }); 
  return NextResponse.json({ ok: true }); 
} 
