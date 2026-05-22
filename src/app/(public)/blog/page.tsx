import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import { listCityHomeArticles } from "@/server/article/listCityHomeArticles";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { BlogIndex } from "./BlogIndex";

export const metadata: Metadata = applyGlobalRobotsOverride({
  title: "Журнал — mamaGo",
  description: "Идеи для прогулок, маршруты и советы для семей с детьми",
});

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city: citySlug } = await searchParams;

  const city = citySlug
    ? await prisma.city.findUnique({
        where: { slug: citySlug },
        select: { id: true, slug: true, name: true },
      })
    : null;

  const articles = city ? await listCityHomeArticles(city) : [];

  return (
    <main>
      <BlogIndex articles={articles} />
    </main>
  );
}
