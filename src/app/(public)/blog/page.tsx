import { permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  buildAbsoluteCanonicalUrl,
  buildCityPublicPath,
} from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { listNationalBlogArticles } from "@/server/article/listCityHomeArticles";
import { BlogIndex } from "./BlogIndex";

export const metadata: Metadata = applyGlobalRobotsOverride({
  title: "Журнал — mamaGo",
  description: "Идеи для прогулок, маршруты и советы для семей с детьми",
  alternates: {
    canonical: buildAbsoluteCanonicalUrl("/blog"),
  },
});

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city: citySlug } = await searchParams;

  // Preserve legacy/query-based links while keeping /{city}/blog as the only
  // canonical city-scoped journal listing.
  if (citySlug) {
    permanentRedirect(
      buildCityPublicPath({
        citySlug,
        type: "journal",
      }),
    );
  }

  const articles = await listNationalBlogArticles();

  return (
    <main>
      <BlogIndex articles={articles} />
    </main>
  );
}
