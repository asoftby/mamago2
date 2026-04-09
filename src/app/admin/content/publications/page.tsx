import { PublicationsIndexClient } from "@/components/admin/publications/PublicationsIndexClient";
import { listArticlesForPublicationsIndex } from "@/lib/article/listArticlesForPublicationsIndex";
import prisma from "@/lib/prisma";

export default async function AdminPublicationsPage() {
  const [rows, cities] = await Promise.all([
    listArticlesForPublicationsIndex(),
    prisma.city.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return <PublicationsIndexClient initialRows={rows} cities={cities} />;
}
