import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";

/**
 * Коллекции в «Моих идеях».
 *
 * БД не гарантирует, что идея и коллекция принадлежат одному пользователю
 * (CollectionItem ссылается на обе по id). Поэтому КАЖДАЯ функция здесь
 * принимает userId и сама проверяет владение и коллекцией, и идеей; чужое и
 * несуществующее неразличимы (404), чтобы не раскрывать чужие id.
 */

export const COLLECTION_TITLE_MAX = 60;
export const COLLECTIONS_PER_USER_LIMIT = 50;
const COVERS_PER_COLLECTION = 4;
/** Берём с запасом: часть идей может быть без картинки. */
const COVER_CANDIDATES_PER_COLLECTION = 12;

export type IdeaCollectionErrorCode =
  | "IDEA_NOT_FOUND"
  | "COLLECTION_NOT_FOUND"
  | "COLLECTION_EXISTS"
  | "COLLECTION_LIMIT"
  | "INVALID_TITLE";

const ERROR_STATUS: Record<IdeaCollectionErrorCode, number> = {
  IDEA_NOT_FOUND: 404,
  COLLECTION_NOT_FOUND: 404,
  COLLECTION_EXISTS: 409,
  COLLECTION_LIMIT: 422,
  INVALID_TITLE: 400,
};

export class IdeaCollectionError extends Error {
  readonly status: number;
  constructor(readonly code: IdeaCollectionErrorCode) {
    super(code);
    this.name = "IdeaCollectionError";
    this.status = ERROR_STATUS[code];
  }
}

export type IdeaKind = "ACTIVITY" | "OFFER" | "ROUTE" | "PLACE" | "ARTICLE";
/** `id` — id сущности (activityId / offerId / ...), а не id строки *Idea. */
export type IdeaTarget = { kind: IdeaKind; id: string };

const FK_FIELD = {
  ACTIVITY: "ideaId",
  OFFER: "offerIdeaId",
  ROUTE: "routeIdeaId",
  PLACE: "placeIdeaId",
  ARTICLE: "articleIdeaId",
} as const satisfies Record<IdeaKind, keyof Prisma.CollectionItemUncheckedCreateInput>;

const TARGET_KEYS: Array<[string, IdeaKind]> = [
  ["activityId", "ACTIVITY"],
  ["offerId", "OFFER"],
  ["routeId", "ROUTE"],
  ["placeId", "PLACE"],
  ["articleId", "ARTICLE"],
];

/** Достаёт цель из тела запроса или query: первый непустой *Id. */
export function parseIdeaTarget(source: URLSearchParams | Record<string, unknown>): IdeaTarget | null {
  for (const [key, kind] of TARGET_KEYS) {
    const raw = source instanceof URLSearchParams ? source.get(key) : source[key];
    if (typeof raw === "string" && raw.trim()) return { kind, id: raw.trim() };
  }
  return null;
}

export function normalizeCollectionTitle(input: unknown): string {
  const title = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (title.length < 1 || title.length > COLLECTION_TITLE_MAX) {
    throw new IdeaCollectionError("INVALID_TITLE");
  }
  return title;
}

type Tx = Prisma.TransactionClient;

async function findIdeaRowId(tx: Tx, userId: string, target: IdeaTarget): Promise<string | null> {
  const select = { id: true } as const;
  switch (target.kind) {
    case "ACTIVITY":
      return (await tx.idea.findUnique({ where: { userId_activityId: { userId, activityId: target.id } }, select }))?.id ?? null;
    case "OFFER":
      return (await tx.offerIdea.findUnique({ where: { userId_offerId: { userId, offerId: target.id } }, select }))?.id ?? null;
    case "ROUTE":
      return (await tx.routeIdea.findUnique({ where: { userId_routeId: { userId, routeId: target.id } }, select }))?.id ?? null;
    case "PLACE":
      return (await tx.placeIdea.findUnique({ where: { userId_placeId: { userId, placeId: target.id } }, select }))?.id ?? null;
    case "ARTICLE":
      return (await tx.articleIdea.findUnique({ where: { userId_articleId: { userId, articleId: target.id } }, select }))?.id ?? null;
  }
}

async function requireIdeaRowId(tx: Tx, userId: string, target: IdeaTarget): Promise<string> {
  const id = await findIdeaRowId(tx, userId, target);
  if (!id) throw new IdeaCollectionError("IDEA_NOT_FOUND");
  return id;
}

/** Все collectionIds должны принадлежать userId, иначе 404 (без утечки чужих id). */
export async function assertCollectionsOwned(
  tx: Tx | typeof prisma,
  userId: string,
  collectionIds: string[],
): Promise<string[]> {
  const unique = [...new Set(collectionIds)];
  if (unique.length === 0) return unique;
  const owned = await tx.collection.count({ where: { id: { in: unique }, userId } });
  if (owned !== unique.length) throw new IdeaCollectionError("COLLECTION_NOT_FOUND");
  return unique;
}

/** Добавляет сохранённую идею в коллекции (аддитивно, идемпотентно). */
export async function addIdeaToCollections(
  userId: string,
  target: IdeaTarget,
  collectionIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const ids = await assertCollectionsOwned(tx, userId, collectionIds);
    const ideaRowId = await requireIdeaRowId(tx, userId, target);
    if (ids.length === 0) return;
    const fk = FK_FIELD[target.kind];
    await tx.collectionItem.createMany({
      data: ids.map((collectionId) => ({ collectionId, [fk]: ideaRowId }) as Prisma.CollectionItemCreateManyInput),
      skipDuplicates: true,
    });
    await tx.collection.updateMany({ where: { id: { in: ids }, userId }, data: { updatedAt: new Date() } });
  });
}

/**
 * Atomically save an idea and attach it to the selected owned collections.
 * A deleted/foreign collection must never leave a saved idea behind after 404.
 * Exclusive row locks hold ownership valid until commit and prevent
 * concurrent row-lock upgrade deadlocks when updatedAt is changed; deletion
 * cannot interleave between the validation and membership insertion.
 */
export async function saveIdeaWithCollections(
  userId: string,
  target: IdeaTarget,
  collectionIds: string[],
) {
  return prisma.$transaction(async (tx) => {
    const ids = await assertCollectionsOwned(tx, userId, collectionIds);
    if (ids.length === 0) throw new IdeaCollectionError("COLLECTION_NOT_FOUND");
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Collection"
      WHERE "userId" = ${userId} AND "id" IN (${Prisma.join(ids)})
      FOR UPDATE
    `;
    if (locked.length !== ids.length) throw new IdeaCollectionError("COLLECTION_NOT_FOUND");

    const where = { userId };
    let saved;
    switch (target.kind) {
      case "ACTIVITY":
        saved = await tx.idea.upsert({
          where: { userId_activityId: { ...where, activityId: target.id } },
          create: { ...where, activityId: target.id }, update: {},
        });
        break;
      case "OFFER":
        saved = await tx.offerIdea.upsert({
          where: { userId_offerId: { ...where, offerId: target.id } },
          create: { ...where, offerId: target.id }, update: {},
        });
        break;
      case "ROUTE":
        saved = await tx.routeIdea.upsert({
          where: { userId_routeId: { ...where, routeId: target.id } },
          create: { ...where, routeId: target.id }, update: {},
        });
        break;
      case "PLACE":
        saved = await tx.placeIdea.upsert({
          where: { userId_placeId: { ...where, placeId: target.id } },
          create: { ...where, placeId: target.id }, update: {},
        });
        break;
      case "ARTICLE":
        saved = await tx.articleIdea.upsert({
          where: { userId_articleId: { ...where, articleId: target.id } },
          create: { ...where, articleId: target.id }, update: {},
        });
        break;
    }
    const fk = FK_FIELD[target.kind];
    await tx.collectionItem.createMany({
      data: ids.map((collectionId) => ({ collectionId, [fk]: saved.id }) as Prisma.CollectionItemCreateManyInput),
      skipDuplicates: true,
    });
    await tx.collection.updateMany({ where: { id: { in: ids }, userId }, data: { updatedAt: new Date() } });
    return saved;
  });
}

/** Задаёт ПОЛНЫЙ набор коллекций идеи («В коллекцию», перенос). Возвращает итоговый набор. */
export async function setIdeaCollections(
  userId: string,
  target: IdeaTarget,
  collectionIds: string[],
): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    // Serialize replacement of the full membership set for one saved idea.
    // Without a lock concurrent PUT [A] / PUT [B] may incorrectly leave [A,B].
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`idea-collections:${userId}:${target.kind}:${target.id}`}))`;
    const wanted = await assertCollectionsOwned(tx, userId, collectionIds);
    const ideaRowId = await requireIdeaRowId(tx, userId, target);
    const fk = FK_FIELD[target.kind];

    const existing = await tx.collectionItem.findMany({
      where: { [fk]: ideaRowId } as Prisma.CollectionItemWhereInput,
      select: { collectionId: true },
    });
    const have = new Set(existing.map((row) => row.collectionId));
    const want = new Set(wanted);
    const toRemove = [...have].filter((id) => !want.has(id));
    const toAdd = wanted.filter((id) => !have.has(id));

    if (toRemove.length > 0) {
      await tx.collectionItem.deleteMany({
        where: { collectionId: { in: toRemove }, [fk]: ideaRowId } as Prisma.CollectionItemWhereInput,
      });
    }
    if (toAdd.length > 0) {
      await tx.collectionItem.createMany({
        data: toAdd.map((collectionId) => ({ collectionId, [fk]: ideaRowId }) as Prisma.CollectionItemCreateManyInput),
        skipDuplicates: true,
      });
    }
    const touched = [...toRemove, ...toAdd];
    if (touched.length > 0) {
      await tx.collection.updateMany({ where: { id: { in: touched }, userId }, data: { updatedAt: new Date() } });
    }
    return wanted;
  });
}

/** В каких коллекциях лежит идея; несохранённая идея → []. */
export async function getIdeaCollectionIds(userId: string, target: IdeaTarget): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const ideaRowId = await findIdeaRowId(tx, userId, target);
    if (!ideaRowId) return [];
    const fk = FK_FIELD[target.kind];
    const rows = await tx.collectionItem.findMany({
      where: { [fk]: ideaRowId, collection: { userId } } as Prisma.CollectionItemWhereInput,
      select: { collectionId: true },
    });
    return rows.map((row) => row.collectionId);
  });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function titleTaken(tx: Tx, userId: string, title: string, exceptId?: string): Promise<boolean> {
  const clash = await tx.collection.findFirst({
    where: {
      userId,
      title: { equals: title, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return clash !== null;
}

export type CollectionDto = { id: string; title: string; count: number; covers: string[]; updatedAt: string };

/**
 * Создаёт коллекцию. С `activityId` сразу сохраняет идею (upsert) и кладёт в неё.
 * Лимит и дубль проверяются под advisory-lock пользователя, чтобы параллельные
 * запросы не обошли лимит; дубль дополнительно ловится уникальным индексом.
 */
export async function createCollection(
  userId: string,
  rawTitle: unknown,
  options: { activityId?: string } = {},
): Promise<{ id: string; title: string }> {
  const title = normalizeCollectionTitle(rawTitle);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`collections:${userId}`}))`;
      if ((await tx.collection.count({ where: { userId } })) >= COLLECTIONS_PER_USER_LIMIT) {
        throw new IdeaCollectionError("COLLECTION_LIMIT");
      }
      if (await titleTaken(tx, userId, title)) throw new IdeaCollectionError("COLLECTION_EXISTS");

      const collection = await tx.collection.create({ data: { userId, title }, select: { id: true, title: true } });
      if (options.activityId) {
        const idea = await tx.idea.upsert({
          where: { userId_activityId: { userId, activityId: options.activityId } },
          create: { userId, activityId: options.activityId },
          update: {},
          select: { id: true },
        });
        await tx.collectionItem.create({ data: { collectionId: collection.id, ideaId: idea.id } });
      }
      return collection;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new IdeaCollectionError("COLLECTION_EXISTS");
    throw error;
  }
}

export async function renameCollection(userId: string, collectionId: string, rawTitle: unknown): Promise<{ id: string; title: string }> {
  const title = normalizeCollectionTitle(rawTitle);
  try {
    return await prisma.$transaction(async (tx) => {
      const owned = await tx.collection.findFirst({ where: { id: collectionId, userId }, select: { id: true } });
      if (!owned) throw new IdeaCollectionError("COLLECTION_NOT_FOUND");
      if (await titleTaken(tx, userId, title, collectionId)) throw new IdeaCollectionError("COLLECTION_EXISTS");
      return tx.collection.update({ where: { id: collectionId }, data: { title }, select: { id: true, title: true } });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new IdeaCollectionError("COLLECTION_EXISTS");
    throw error;
  }
}

/** Удаляет коллекцию и её CollectionItem; сами идеи остаются («Без коллекции»). */
export async function deleteCollection(userId: string, collectionId: string): Promise<void> {
  const { count } = await prisma.collection.deleteMany({ where: { id: collectionId, userId } });
  if (count === 0) throw new IdeaCollectionError("COLLECTION_NOT_FOUND");
}

type CandidateRow = {
  collectionId: string;
  ideaId: string | null;
  offerIdeaId: string | null;
  routeIdeaId: string | null;
  placeIdeaId: string | null;
  articleIdeaId: string | null;
};

/** Обложки без N+1: один оконный запрос + по одному батчу на тип идеи. */
async function loadCovers(collectionIds: string[]): Promise<Map<string, string[]>> {
  const covers = new Map<string, string[]>();
  if (collectionIds.length === 0) return covers;

  const rows = await prisma.$queryRaw<CandidateRow[]>`
    SELECT "collectionId", "ideaId", "offerIdeaId", "routeIdeaId", "placeIdeaId", "articleIdeaId"
    FROM (
      SELECT ci.*, row_number() OVER (PARTITION BY ci."collectionId" ORDER BY ci."addedAt" DESC, ci."id" DESC) AS rn
      FROM "CollectionItem" ci
      WHERE ci."collectionId" IN (${Prisma.join(collectionIds)})
    ) t
    WHERE t.rn <= ${COVER_CANDIDATES_PER_COLLECTION}
    ORDER BY t."collectionId", t.rn
  `;

  const pick = (key: keyof Omit<CandidateRow, "collectionId">) =>
    [...new Set(rows.map((row) => row[key]).filter((id): id is string => Boolean(id)))];

  const [ideas, offerIdeas, routeIdeas, articleIdeas] = await Promise.all([
    prisma.idea.findMany({ where: { id: { in: pick("ideaId") } }, select: { id: true, activityId: true } }),
    prisma.offerIdea.findMany({ where: { id: { in: pick("offerIdeaId") } }, select: { id: true, offer: { select: { coverImage: true } } } }),
    prisma.routeIdea.findMany({ where: { id: { in: pick("routeIdeaId") } }, select: { id: true, route: { select: { coverImageUrl: true } } } }),
    prisma.articleIdea.findMany({ where: { id: { in: pick("articleIdeaId") } }, select: { id: true, article: { select: { heroImage: true } } } }),
  ]);
  const activities = await prisma.activity.findMany({
    where: { id: { in: ideas.map((idea) => idea.activityId) } },
    select: {
      id: true,
      coverImageId: true,
      coverImageUrl: true,
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { id: true, url: true, mediaAssetId: true } },
    },
  });

  const activityCover = new Map(activities.map((a) => [a.id, resolveActivityCoverUrl(a)]));
  const byIdeaRow = new Map<string, string | null>();
  for (const idea of ideas) byIdeaRow.set(idea.id, activityCover.get(idea.activityId) ?? null);
  for (const idea of offerIdeas) byIdeaRow.set(idea.id, idea.offer?.coverImage ?? null);
  for (const idea of routeIdeas) byIdeaRow.set(idea.id, idea.route?.coverImageUrl ?? null);
  for (const idea of articleIdeas) byIdeaRow.set(idea.id, idea.article?.heroImage ?? null);
  // TODO(ideas-collections PR4): PlaceIdea без обложки — у Place нет единого поля; взять первое фото из медиа места.

  for (const row of rows) {
    const ideaRowId = row.ideaId ?? row.offerIdeaId ?? row.routeIdeaId ?? row.articleIdeaId;
    const url = ideaRowId ? byIdeaRow.get(ideaRowId) : null;
    if (!url) continue;
    const list = covers.get(row.collectionId) ?? [];
    if (list.length < COVERS_PER_COLLECTION) list.push(url);
    covers.set(row.collectionId, list);
  }
  return covers;
}

/** Коллекции пользователя: count через _count, обложки одним агрегатом; sort, затем updatedAt desc. */
export async function listCollections(userId: string): Promise<CollectionDto[]> {
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: [{ sort: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, updatedAt: true, _count: { select: { items: true } } },
  });
  const covers = await loadCovers(collections.map((c) => c.id));
  return collections.map((c) => ({
    id: c.id,
    title: c.title,
    count: c._count.items,
    covers: covers.get(c.id) ?? [],
    updatedAt: c.updatedAt.toISOString(),
  }));
}
