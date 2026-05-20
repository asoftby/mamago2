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

export async function GET() {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const items = await prisma.filterDefinition.findMany({
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    include: { options: { orderBy: [{ order: "asc" }, { value: "asc" }] } },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const slug = String(body.slug || "").trim();
  const title = String(body.title || "").trim();
  const type = String(body.type || "single").trim();
  const ui = String(body.ui || "chips").trim();

  if (!slug || !title) {
    return NextResponse.json({ ok: false, error: "slug and title required" }, { status: 400 });
  }
  if (!isFilterType(type)) {
    return NextResponse.json(
      { ok: false, error: `Invalid type "${type}". Allowed: single, multiple, boolean, range` },
      { status: 422 },
    );
  }
  if (!isFilterUi(ui)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid ui "${ui}". Allowed: chips, tabs, toggle, switcher, range, checkboxes, select, multiselect`,
      },
      { status: 422 },
    );
  }
  if (!isCompatibleTypeUi(type, ui)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Incompatible type+ui: type="${type}" does not support ui="${ui}". Allowed ui for ${type}: ${getCompatibleUis(type).join(", ")}`,
      },
      { status: 422 },
    );
  }

  const created = await prisma.filterDefinition.create({
    data: { slug, title, type, ui, order: 0, isActive: true },
  });
  return NextResponse.json(created);
}
