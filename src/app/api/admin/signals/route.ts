import { NextResponse } from "next/server";
import { Prisma, SignalDomain, SignalEntityType, SignalStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageSignalDefinitions } from "@/lib/auth/signalDefinitionsAdmin";
import { ensureEventCategorySlug } from "@/lib/taxonomy/eventCategorySlug";
import { assertValidSignalParentIdOrNull } from "@/lib/taxonomy/signalHierarchyServer";

export const runtime = "nodejs";

const SCHEMA_OUT_OF_SYNC_MESSAGE =
  "Схема БД не совпадает с кодом: выполните npx prisma migrate deploy (в dev можно npx prisma db push).";

function jsonFromPrismaError(e: unknown): NextResponse | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (e.code === "P2021" || e.code === "P2022") {
    return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
  }
  if (e.code === "P2003") {
    return NextResponse.json(
      { error: "Некорректная родительская запись (связь с БД нарушена)" },
      { status: 400 },
    );
  }
  return null;
}

function jsonFromDbUnavailable(e: unknown): NextResponse | null {
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      { error: "База данных недоступна. Проверьте DATABASE_URL и что PostgreSQL запущен." },
      { status: 503 },
    );
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageSignalDefinitions(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const domain = url.searchParams.get("domain");
    const entityType = url.searchParams.get("entityType");
    const includeDeprecated = url.searchParams.get("includeDeprecated") === "true";

    // Build where clause
    const where: Prisma.SignalDefinitionWhereInput = {};
    
    // By default, return only ACTIVE signals unless includeDeprecated is true
    if (!includeDeprecated) {
      where.status = "ACTIVE";
    }

    // Filter by domain if provided
    if (domain) {
      where.domain = domain as SignalDomain;
    }

    // Filter by entityType if provided (check if entityTypes array contains the type)
    if (entityType) {
      where.entityTypes = {
        has: entityType as SignalEntityType
      };
    }

    const items = await prisma.signalDefinition.findMany({
      where,
      orderBy: [{ parentId: "asc" }, { order: "asc" }, { id: "asc" }],
      include: {
        parent: { select: { id: true, title: true, slug: true } },
        options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
        _count: { select: { children: true, options: true } },
      },
    });
    // Убираем SignalGroup `vibe` из админского Discovery (оставляем в БД, но не показываем).
    const filtered = items.filter((x) => x.slug !== "vibe");
    return NextResponse.json(filtered);
  } catch (e) {
    const db = jsonFromDbUnavailable(e);
    if (db) return db;
    const schema = jsonFromPrismaError(e);
    if (schema) return schema;
    console.error("signals GET:", e);
    return NextResponse.json({ error: "Не удалось загрузить сигналы" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageSignalDefinitions(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const slugRaw = String(body.slug ?? "").trim();
    const title = String(body.title ?? "").trim();
    const titleEn = title;

    const parentIdRaw = body.parentId;
    const parentId =
      parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === ""
        ? null
        : String(parentIdRaw);

    const icon = body.icon != null ? String(body.icon).trim() || null : null;
    const order =
      typeof body.order === "number" && Number.isFinite(body.order)
        ? Math.floor(body.order)
        : 0;
    const isActive = Boolean(body.isActive ?? true);
    const isFeatured = Boolean(body.isFeatured ?? false);

    // New fields for domain architecture
    const domain = body.domain && Object.values(SignalDomain).includes(body.domain) 
      ? body.domain as SignalDomain 
      : null;
    
    const entityTypes = Array.isArray(body.entityTypes) 
      ? body.entityTypes.filter((type: unknown) => Object.values(SignalEntityType).includes(type as SignalEntityType))
      : [];
    
    const status = body.status && Object.values(SignalStatus).includes(body.status)
      ? body.status as SignalStatus
      : SignalStatus.ACTIVE;
    
    const replacedById = body.replacedById && typeof body.replacedById === "string" 
      ? body.replacedById 
      : null;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const baseSlug = ensureEventCategorySlug(slugRaw, title);

    await assertValidSignalParentIdOrNull(parentId);

    /** Уникальный slug: при совпадении с сидом / старыми данными добавляем -1, -2, … */
    let slug = "";
    for (let n = 0; n < 500; n++) {
      const candidate = n === 0 ? baseSlug : `${baseSlug}-${n}`;
      const taken = await prisma.signalDefinition.findUnique({
        where: { slug: candidate },
      });
      if (!taken) {
        slug = candidate;
        break;
      }
    }
    if (!slug) {
      return NextResponse.json(
        { error: "Не удалось подобрать уникальный slug" },
        { status: 409 },
      );
    }

    // Validate replacedById if provided
    if (replacedById) {
      const replacedSignal = await prisma.signalDefinition.findUnique({
        where: { id: replacedById },
      });
      if (!replacedSignal) {
        return NextResponse.json(
          { error: "replacedById references non-existent signal" },
          { status: 400 }
        );
      }
    }

    const created = await prisma.signalDefinition.create({
      data: {
        slug,
        title,
        titleEn,
        icon,
        order,
        isActive,
        isFeatured,
        parentId,
        domain,
        entityTypes,
        status,
        replacedById,
      },
      include: {
        parent: { select: { id: true, title: true, slug: true } },
        options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
        _count: { select: { children: true, options: true } },
      },
    });
    return NextResponse.json(created);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: "Некорректный JSON в теле запроса" }, { status: 400 });
    }
    const db = jsonFromDbUnavailable(e);
    if (db) return db;
    const schema = jsonFromPrismaError(e);
    if (schema) return schema;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Сигнал с таким slug уже есть — укажите другой slug" },
        { status: 409 },
      );
    }
    if (e instanceof Error) {
      if (e.message === "Parent not found" || e.message === "Only a root signal can be a parent") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }
    console.error("signals POST:", e);
    return NextResponse.json({ error: "Не удалось создать сигнал" }, { status: 500 });
  }
}
