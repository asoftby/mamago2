import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

const VALID_SECTIONS = ["kuda", "classes", "birthday", "routes"] as const;
const VALID_TYPES = ["BUDGET", "FREE_ONLY"] as const;

type ValidSection = (typeof VALID_SECTIONS)[number];
type ValidType = (typeof VALID_TYPES)[number];

function isSectionSystemFilterTableMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.table ?? "").includes("SectionSystemFilter")
  );
}

// GET ?section=classes  → list system filters for section
export async function GET(req: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") as ValidSection | null;

  if (!section || !VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: "section required" }, { status: 400 });
  }

  const rows = await prisma.sectionSystemFilter
    .findMany({
      where: { sectionKey: section },
      orderBy: { sortOrder: "asc" },
    })
    .catch((error) => {
      if (isSectionSystemFilterTableMissing(error)) {
        console.warn(
          "[admin/discovery/system-filters] SectionSystemFilter table not found, returning defaults",
        );
        return [];
      }
      throw error;
    });

  // Return merged with defaults so UI always gets all types
  const result = VALID_TYPES.map((type) => {
    const row = rows.find((r) => r.type === type);
    return {
      id: row?.id ?? null,
      sectionKey: section,
      type,
      enabled: row?.enabled ?? false,
      sortOrder: row?.sortOrder ?? 0,
    };
  });

  return NextResponse.json(result);
}

// POST { sectionKey, type, enabled }  → upsert
export async function POST(req: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const sectionKey = String(body.sectionKey || "").trim() as ValidSection;
  const type = String(body.type || "").trim() as ValidType;
  const enabled = Boolean(body.enabled);

  if (!VALID_SECTIONS.includes(sectionKey)) {
    return NextResponse.json({ error: "invalid sectionKey" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const row = await prisma.sectionSystemFilter.upsert({
    where: { sectionKey_type: { sectionKey, type } },
    update: { enabled },
    create: { sectionKey, type, enabled, sortOrder: 0 },
  });

  return NextResponse.json(row);
}
