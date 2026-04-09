import type { ContentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { PublicationStatus, PublicationType, type PublicationListRow } from "@/lib/publications/domain";

function mapStatus(s: ContentStatus): (typeof PublicationStatus)[keyof typeof PublicationStatus] {
  switch (s) {
    case "DRAFT":
      return PublicationStatus.DRAFT;
    case "PENDING":
      return PublicationStatus.PENDING;
    case "PUBLISHED":
      return PublicationStatus.PUBLISHED;
    case "REJECTED":
      return PublicationStatus.REJECTED;
    case "SCHEDULED":
      return PublicationStatus.SCHEDULED;
    case "ARCHIVED":
      return PublicationStatus.ARCHIVED;
    default:
      return PublicationStatus.DRAFT;
  }
}

function authorLineFromUser(u: { displayName: string | null; email: string } | null | undefined): string {
  const d = u?.displayName?.trim();
  if (d) return d;
  const email = u?.email;
  if (email) {
    const local = email.split("@")[0];
    if (local) return local;
  }
  return "—";
}

export async function listArticlesForPublicationsIndex(): Promise<PublicationListRow[]> {
  const rows = await prisma.article.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      slug: true,
      subtitle: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      contentJson: true,
    },
  });

  /** Колонки вне findMany: в БД без миграций их может не быть (views, coverImageId, authorLabel, authorUserId + join). */
  let manualAuthorById = new Map<string, string | null>();
  let authorUserById = new Map<string, { displayName: string | null; email: string }>();
  let viewsById = new Map<string, number>();
  let coverImageIdById = new Map<string, string | null>();
  let cityContextById = new Map<string, string | null>();
  let authorUserIdById = new Map<string, string | null>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    try {
      const extra = await prisma.$queryRaw<
        Array<{ id: string; authorLabel: string | null; views: bigint | number | null }>
      >(
        Prisma.sql`SELECT id, "authorLabel", views FROM "Article" WHERE id IN (${Prisma.join(ids)})`,
      );
      manualAuthorById = new Map(extra.map((e) => [e.id, e.authorLabel]));
      viewsById = new Map(extra.map((e) => [e.id, Number(e.views ?? 0)]));
    } catch {
      try {
        const extra = await prisma.$queryRaw<Array<{ id: string; authorLabel: string | null }>>(
          Prisma.sql`SELECT id, "authorLabel" FROM "Article" WHERE id IN (${Prisma.join(ids)})`,
        );
        manualAuthorById = new Map(extra.map((e) => [e.id, e.authorLabel]));
      } catch {
        manualAuthorById = new Map();
      }
      viewsById = new Map();
    }
    try {
      const cov = await prisma.$queryRaw<Array<{ id: string; coverImageId: string | null }>>(
        Prisma.sql`SELECT id, "coverImageId" FROM "Article" WHERE id IN (${Prisma.join(ids)})`,
      );
      coverImageIdById = new Map(cov.map((e) => [e.id, e.coverImageId]));
    } catch {
      coverImageIdById = new Map();
    }
    try {
      const cc = await prisma.$queryRaw<Array<{ id: string; cityContext: string | null }>>(
        Prisma.sql`SELECT id, "cityContext" FROM "Article" WHERE id IN (${Prisma.join(ids)})`,
      );
      cityContextById = new Map(cc.map((e) => [e.id, e.cityContext]));
    } catch {
      cityContextById = new Map();
    }
    try {
      const joined = await prisma.$queryRaw<
        Array<{
          id: string;
          authorUserId: string | null;
          displayName: string | null;
          email: string | null;
        }>
      >(
        Prisma.sql`
          SELECT a.id, a."authorUserId", u."displayName", u.email
          FROM "Article" a
          LEFT JOIN "User" u ON u.id = a."authorUserId"
          WHERE a.id IN (${Prisma.join(ids)})
        `,
      );
      authorUserById = new Map(
        joined.map((j) => [j.id, { displayName: j.displayName, email: j.email ?? "" }]),
      );
      authorUserIdById = new Map(joined.map((j) => [j.id, j.authorUserId]));
    } catch {
      authorUserById = new Map();
      authorUserIdById = new Map();
    }
  }

  return rows.map((r) => {
    const content = parseArticleContentJson(r.contentJson);
    const manual = manualAuthorById.get(r.id)?.trim();
    const authorLabel =
      manual && manual.length > 0
        ? manual
        : authorLineFromUser(authorUserById.get(r.id));
    const coverId = coverImageIdById.get(r.id);
    const isBreakingNews = r.subtitle === BREAKING_NEWS_SUBTITLE;
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      type: isBreakingNews ? PublicationType.NEWS : PublicationType.ARTICLE,
      status: mapStatus(r.status),
      authorLabel,
      authorUserId: authorUserIdById.get(r.id) ?? null,
      cityOrContext: cityContextById.get(r.id)?.trim() || "—",
      publishedAt: r.publishedAt?.toISOString() ?? null,
      views: viewsById.get(r.id) ?? 0,
      updatedAt: r.updatedAt.toISOString(),
      hasCover: !!(coverId && String(coverId).trim()),
      hasSlug: !!(r.slug && r.slug.trim()),
      hasBlocks: content.blocks.length > 0,
    };
  });
}
