import { NextResponse } from "next/server";
import type { SearchEntityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

const SEARCH_ENTITY_TYPES: SearchEntityType[] = [
  "activity",
  "offer",
  "place",
  "route",
  "article",
];

/** undefined = param omitted; null = invalid value */
function parseEntityType(raw: string | null): SearchEntityType | undefined | null {
  if (raw == null || raw.trim() === "") return undefined;
  const t = raw.trim().toLowerCase() as SearchEntityType;
  return SEARCH_ENTITY_TYPES.includes(t) ? t : null;
}

/**
 * TEMPORARY: inspect SearchDocument rows for indexing / publish / builder issues.
 * TODO: remove or restrict (e.g. admin + auth) before production hardening.
 */
export async function GET(req: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) {
    return process.env.NODE_ENV === "production"
      ? NextResponse.json({ error: "Not found" }, { status: 404 })
      : auth;
  }

  const { searchParams } = new URL(req.url);
  const typeRaw = searchParams.get("type");
  const q = searchParams.get("q")?.trim() ?? "";

  const entityType = parseEntityType(typeRaw);
  if (entityType === null) {
    return NextResponse.json(
      {
        error: "Invalid type",
        valid: SEARCH_ENTITY_TYPES,
        hint: "Use lowercase enum values, e.g. route (type=ROUTE also works).",
      },
      { status: 400 },
    );
  }

  const where = entityType ? { entityType } : {};

  const [totalInDatabase, docs] = await Promise.all([
    prisma.searchDocument.count({ where }),
    prisma.searchDocument.findMany({
      where,
      take: 20,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const filtered =
    q.length > 0
      ? docs.filter((d) => d.searchText.toLowerCase().includes(q.toLowerCase()))
      : docs;

  return NextResponse.json({
    totalInDatabase,
    fetched: docs.length,
    filteredCount: filtered.length,
    type: entityType ?? null,
    q: q.length > 0 ? q : null,
    docs: filtered.map((d) => ({
      id: d.id,
      entityId: d.entityId,
      entityType: d.entityType,
      title: d.title,
      isPublished: d.isPublished,
      searchText: d.searchText,
      summaryLine: d.summaryLine,
      metaLine: d.metaLine,
      urlPath: d.urlPath,
      imageUrl: d.imageUrl,
      boost: d.boost,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    })),
  });
}
