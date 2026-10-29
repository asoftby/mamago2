import CityArticlePage from "../../[slug]/page";
import { JournalNewsOverlay } from "@/components/journal/JournalNewsOverlay";
import { JournalRegularArticleNavigation } from "@/components/journal/JournalRegularArticleNavigation";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { loadArticleMvpBySlugPublic } from "@/lib/article/articleMvpRenderData";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";

export default async function InterceptedJournalArticle({ params }: { params: Promise<{ city: string; slug: string }> }) {
  const resolved = await params;
  const city = await findCityBySlug(resolved.city.toLowerCase(), {
    isActive: true,
    select: { id: true },
  });
  const article = city ? await loadArticleMvpBySlugPublic(resolved.slug, city.id) : null;

  if (article?.subtitle !== BREAKING_NEWS_SUBTITLE) {
    return <JournalRegularArticleNavigation href={`/${encodeURIComponent(resolved.city)}/blog/${encodeURIComponent(resolved.slug)}`} />;
  }

  return (
    <JournalNewsOverlay>
      <CityArticlePage params={params} />
    </JournalNewsOverlay>
  );
}
