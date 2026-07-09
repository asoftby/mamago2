import { PublicationsIndexClient } from "@/components/admin/publications/PublicationsIndexClient";
import { listArticlesForPublicationsIndex } from "@/lib/article/listArticlesForPublicationsIndex";
import { PublicationType } from "@/lib/publications/domain";
import { ContentStatus } from "@prisma/client";
import {
  deriveArticleArchivedDeletePreflight,
  deriveArticleDeletePreflight,
} from "@/server/services/contentDependencySummary.service";
import prisma from "@/lib/prisma";

export default async function AdminPublicationsPage() {
  const [rows, cities] = await Promise.all([
    listArticlesForPublicationsIndex(),
    prisma.city.findMany({
      where: { isLegacyNonCity: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const articleLifecycleMeta = Object.fromEntries(
    rows
      .filter(
        (row) =>
          row.type === PublicationType.ARTICLE || row.type === PublicationType.NEWS,
      )
      .map((row) => {
        const status = row.status as ContentStatus;
        const deletePreflight = deriveArticleDeletePreflight({
          status,
          publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
        });
        const archivedDeletePreflight = deriveArticleArchivedDeletePreflight({
          status,
        });
        return [
          row.id,
          {
            deletePreflight,
            archivedDeletePreflight,
          },
        ];
      }),
  );

  return (
    <PublicationsIndexClient
      initialRows={rows}
      cities={cities}
      articleLifecycleMeta={articleLifecycleMeta}
    />
  );
}
