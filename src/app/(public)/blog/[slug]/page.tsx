/**
 * /blog/[slug] — COUNTRY-scope articles only.
 *
 * If the slug belongs to a CITY article (geoScope === CITY), issue a
 * 308 permanent redirect to /{city}/blog/{slug}.
 */
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import {
  buildCityPublicPath,
  buildNationalArticlePath,
} from "@/lib/routing/cityPaths";
import { notFound, permanentRedirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { ArticleContent } from "@/components/article/ArticleContent";
import { ArticleEventCardBlock } from "@/components/article/blocks/ArticleEventCardBlock";
import { ArticlePlaceCardBlock } from "@/components/article/blocks/ArticlePlaceCardBlock";
import { ArticleOfferCardBlock } from "@/components/article/blocks/ArticleOfferCardBlock";
import { ArticleRouteCardBlock } from "@/components/article/blocks/ArticleRouteCardBlock";
import { ArticlePlacesShowcaseBlock } from "@/components/article/blocks/ArticlePlacesShowcaseBlock";
import prisma from "@/lib/prisma";
import { findArticleBySlug } from "@/lib/slug/articleSlugService";
import { buildArticleJsonLd } from "@/lib/seo/schema/buildArticleJsonLd";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import type { ArticleVm } from "@/lib/blog/articleTypes";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { loadArticleMvpBySlugPublic, loadRelatedBreakingNews } from "@/lib/article/articleMvpRenderData";
import { ArticleMvpView } from "@/components/article/mvp/ArticleMvpView";
import { BreakingNewsView } from "@/components/article/mvp/BreakingNewsView";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import {
  incrementPublishedArticleViews,
  shouldCountPublishedArticleViewRequest,
} from "@/lib/article/articleViews";

/**
 * Redirect to canonical city-scoped URL if the article is CITY-scoped.
 * Returns null if no redirect needed.
 */
async function resolveCityRedirect(slug: string): Promise<string | null> {
  // Look up by slug without cityId scope — use raw DB lookup to detect geoScope
  const article = await prisma.article.findFirst({
    where: { slug },
    select: { geoScope: true, city: { select: { slug: true } } },
  });
  if (!article) {
    // Check history (any scope)
    const hist = await prisma.articleSlugHistory.findFirst({
      where: { slug },
      include: { article: { select: { geoScope: true, city: { select: { slug: true } } } } },
    });
    if (hist?.article.geoScope === "CITY" && hist.article.city?.slug) {
      // Redirect old slug → current city-scoped slug via the article's current slug
      const current = await prisma.article.findUnique({
        where: { id: hist.articleId },
        select: { slug: true, city: { select: { slug: true } } },
      });
      if (current?.slug && current.city?.slug) {
        return buildCityPublicPath({
          citySlug: current.city.slug,
          type: "article",
          slug: current.slug,
        });
      }
    }
    return null;
  }
  if (article.geoScope === "CITY" && article.city?.slug) {
    return buildCityPublicPath({
      citySlug: article.city.slug,
      type: "article",
      slug,
    });
  }
  return null;
}

async function getArticle(slug: string): Promise<ArticleVm | null> {
  // COUNTRY scope only: cityId IS NULL
  const resolved = await findArticleBySlug(slug, null);
  if (resolved) {
    const a = await prisma.article.findUnique({
      where: { id: resolved.articleId },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        excerpt: true,
        heroImage: true,
        publishedAt: true,
        seoTitle: true,
        seoDescription: true,
        seoH1: true,
        seoCanonicalUrl: true,
        seoOgTitle: true,
        seoOgDescription: true,
        seoOgImage: true,
        seoRobots: true,
        seoJsonLdOverride: true,
        noindex: true,
      },
    });
    if (!a) return null;
    return {
      slug: a.slug ?? slug,
      title: a.seoH1?.trim() || a.title,
      subtitle: a.subtitle ?? (a.excerpt ?? ""),
      category: "Журнал",
      readTime: 5,
      publishedAt: a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : "—",
      heroImage: a.heroImage,
      _redirectToSlug: resolved.isRedirect ? a.slug : null,
      _seo: a,
    };
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // If this is a CITY article, redirect immediately (metadata will follow)
  const cityRedirect = await resolveCityRedirect(slug);
  if (cityRedirect) {
    permanentRedirect(cityRedirect);
  }

  const publicBase = getCanonicalPublicAppUrl();
  const defaultCanonical = `${publicBase}${buildNationalArticlePath(slug)}`;
  // COUNTRY scope (cityId = null)
  const mvp = await loadArticleMvpBySlugPublic(slug, null);
  if (mvp) {
    const article = await prisma.article.findUnique({
      where: { id: mvp.id },
      select: {
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoOgTitle: true,
        seoOgDescription: true,
        seoOgImage: true,
        seoRobots: true,
        noindex: true,
      },
    });
    const title = article?.seoTitle?.trim() || `${mvp.title} — mamaGo`;
    const description = article?.seoDescription?.trim() || mvp.excerpt?.trim() || undefined;
    const canonical = article?.seoCanonicalUrl?.trim() || defaultCanonical;
    const noindex =
      article?.noindex === true ||
      (article?.seoRobots?.toLowerCase().includes("noindex") ?? false);
    return {
      ...buildOgMeta({
        title: article?.seoOgTitle?.trim() || title,
        description: article?.seoOgDescription?.trim() || description,
        image: article?.seoOgImage?.trim() || mvp.heroUrl,
        url: canonical,
        robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
      }),
      title,
      description,
      alternates: { canonical },
    };
  }
  const article = await getArticle(slug);
  if (!article) return {};
  if ("_redirectToSlug" in article && article._redirectToSlug) {
    permanentRedirect(buildNationalArticlePath(article._redirectToSlug));
  }
  const seo = "_seo" in article ? article._seo : undefined;
  const ogImageUrl =
    seo?.heroImage?.trim() || seo?.seoOgImage?.trim() || undefined;
  const noindexFlag =
    seo?.noindex === true || (seo?.seoRobots?.toLowerCase().includes("noindex") ?? false);
  const title = seo?.seoTitle?.trim() || `${article.title} — mamaGo`;
  const description = seo?.seoDescription?.trim() || article.subtitle;
  const canonical = seo?.seoCanonicalUrl?.trim() || defaultCanonical;

  return {
    ...buildOgMeta({
      title: seo?.seoOgTitle?.trim() || title,
      description: seo?.seoOgDescription?.trim() || description,
      image: ogImageUrl,
      url: canonical,
      robots: noindexFlag ? { index: false, follow: false } : { index: true, follow: true },
    }),
    title,
    description,
    alternates: { canonical },
  };
}

// ─── Mock showcase places ────────────────────────────────────────────────────
const showcasePlaces = [
  {
    id: "1",
    title: "Парк Горького",
    href: "/places/park-gorkogo",
    category: "Парк",
    location: "Минск, Центральный район",
  },
  {
    id: "2",
    title: "Ботанический сад",
    href: "/places/botanicheskiy-sad",
    category: "Природа",
    location: "Минск, Советский район",
  },
  {
    id: "3",
    title: "Музей природы и экологии",
    href: "/places/muzey-prirody",
    category: "Музей",
    location: "Минск, Центральный район",
  },
  {
    id: "4",
    title: "Планетарий",
    href: "/places/planetariy",
    category: "Наука",
    location: "Минск",
  },
  {
    id: "5",
    title: "Минский зоопарк",
    href: "/places/zoopark",
    category: "Зоопарк",
    location: "Минск, Фрунзенский район",
  },
  {
    id: "6",
    title: "Студия керамики «Глина»",
    href: "/places/studiya-glina",
    category: "Мастер-классы",
    location: "Минск, Октябрьский район",
  },
  {
    id: "7",
    title: "Набережная Свислочи",
    href: "/places/naberezhnaya-svislochi",
    category: "Прогулки",
    location: "Минск",
  },
];

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Redirect CITY articles to city-scoped URL
  const cityRedirect = await resolveCityRedirect(slug);
  if (cityRedirect) {
    permanentRedirect(cityRedirect);
  }

  const user = await getCurrentUser();
  const canEditPublishedArticle = user?.role === "ADMIN" || user?.role === "MODERATOR";
  // COUNTRY scope (cityId = null)
  const mvp = await loadArticleMvpBySlugPublic(slug, null);
  if (mvp) {
    const editHref =
      canEditPublishedArticle
        ? (
            mvp.subtitle === BREAKING_NEWS_SUBTITLE
              ? `/admin/content/publications/new?type=news&id=${mvp.id}`
              : `/admin/content/articles/${mvp.id}/edit`
          )
        : undefined;

    if (await shouldCountPublishedArticleViewRequest()) {
      await incrementPublishedArticleViews(mvp.id);
    }

    if (mvp.subtitle === BREAKING_NEWS_SUBTITLE) {
      const related = await loadRelatedBreakingNews(mvp.id);
      return (
        <>
          <AnalyticsDetailBeacon entityType="ARTICLE" entityId={mvp.id} vertical="CITY" />
          <BreakingNewsView
            articleId={mvp.id}
            title={mvp.title}
            excerpt={mvp.excerpt}
            publishedAt={mvp.publishedAt}
            blocks={mvp.blocks}
            author={mvp.author}
            tags={mvp.tags}
            related={related}
            editHref={editHref}
          />
        </>
      );
    }

    return (
      <>
        <AnalyticsDetailBeacon entityType="ARTICLE" entityId={mvp.id} vertical="CITY" />
        <ArticleMvpView
          title={mvp.title}
          subtitle={mvp.subtitle}
          excerpt={mvp.excerpt}
          publishedAt={mvp.publishedAt}
          blocks={mvp.blocks}
          tags={mvp.tags}
          categoryLabel={mvp.categoryLabel}
          editHref={editHref}
        />
      </>
    );
  }

  const article = await getArticle(slug);
  if (!article) notFound();
  if ("_redirectToSlug" in article && article._redirectToSlug) {
    permanentRedirect(buildNationalArticlePath(article._redirectToSlug));
  }

  const seo = "_seo" in article ? article._seo : undefined;
  const publicBase = getCanonicalPublicAppUrl();
  const jsonLd =
    seo?.seoJsonLdOverride && typeof seo.seoJsonLdOverride === "object"
      ? (seo.seoJsonLdOverride as Record<string, unknown>)
      : seo
        ? buildArticleJsonLd({
            article: {
              slug: seo.slug,
              title: seo.title,
              excerpt: seo.excerpt,
              heroImage: seo.heroImage,
              publishedAt: seo.publishedAt,
            },
            publicBase,
          })
        : null;
  const legacyEditHref =
    canEditPublishedArticle && seo?.id ? `/admin/content/articles/${seo.id}/edit` : undefined;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <div className="mb-4 md:mb-0">
        <MobileSmartBackButton />
      </div>
      {"_seo" in article && article._seo?.id ? (
        <AnalyticsDetailBeacon
          entityType="ARTICLE"
          entityId={article._seo.id}
          vertical="CITY"
        />
      ) : null}
      {jsonLd && (
        <script
          type="application/ld+json"

          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ArticleHeader
        title={article.title}
        subtitle={article.subtitle}
        category={article.category}
        readTime={article.readTime}
        publishedAt={article.publishedAt}
        editHref={legacyEditHref}
        heroImage={
          article.heroImage
            ? { src: article.heroImage, alt: article.title }
            : undefined
        }
      />

      <ArticleContent>
        {/* ── Intro ── */}
        <p>
          Минск — город, в котором всегда есть что открыть заново. Особенно если
          рядом дети, которым нужны впечатления, движение и немного волшебства.
        </p>
        <p>
          Мы собрали семь идей для насыщенных выходных — от тихих прогулок в
          парке до шумных мастер-классов, где можно испачкать руки в краске и
          унести домой что-то своё.
        </p>

        {/* ── Event block ── */}
        <ArticleEventCardBlock
          title="Весенний фестиваль в Парке Горького"
          href="/events/vesenniy-festival"
          dateLabel="22–23 марта"
          location="Минск, Парк Горького"
          ageLabel="0–12 лет"
          badge="Бесплатно"
        />

        {/* ── Section ── */}
        <h2>Мастер-классы: руки в дело</h2>
        <p>
          Несколько студий в городе принимают детей от 4 лет. Час за гончарным
          кругом — и ребёнок уходит с собственной миской, которую потом можно
          раскрасить.
        </p>

        <blockquote>
          <p>
            Лучшие воспоминания детства — это не вещи, а моменты. Дайте детям
            время, пространство и немного глины.
          </p>
        </blockquote>

        {/* ── Place block ── */}
        <ArticlePlaceCardBlock
          title="Студия керамики «Глина»"
          href="/places/studiya-glina"
          category="Мастер-классы"
          location="Минск, Октябрьский район"
          description="Гончарный круг, лепка, роспись — для детей от 4 лет"
        />

        {/* ── Section ── */}
        <h2>Природа и наука</h2>
        <p>
          Ботанический сад особенно хорош весной и летом. Оранжерея работает
          круглый год — там тропики, кактусы и огромные листья, которые дети
          обожают трогать.
        </p>
        <p>
          Музей природы и экологии — динозавры, чучела животных, интерактивные
          экспозиции. Дети в восторге, взрослые тоже узнают что-то новое.
        </p>

        <ul>
          <li>Работает ежедневно с 10:00 до 18:00</li>
          <li>Вход для детей до 5 лет — бесплатно</li>
          <li>Есть аудиогид на русском и белорусском</li>
        </ul>

        {/* ── Offer block ── */}
        <ArticleOfferCardBlock
          title="Семейный абонемент в Ботанический сад"
          href="/offers/botanicheskiy-sad-abonement"
          highlight="Неограниченные посещения на 3 месяца для семьи до 4 человек"
          badge="Спецпредложение"
          badgeVariant="promo"
        />

        {/* ── Section ── */}
        <h2>Велопрогулка по набережной</h2>
        <p>
          Свислочь, набережная, велодорожки — идеальный маршрут для семьи.
          Велосипеды можно взять в аренду прямо на месте. Маршрут несложный,
          подходит даже для самых маленьких.
        </p>

        {/* ── Route block ── */}
        <ArticleRouteCardBlock
          title="Велопрогулка по набережной Свислочи"
          href="/routes/velotropa-svisloch"
          city="Минск"
          stopCount={4}
          ageLabel="3+ лет"
          duration="~2 часа"
          description="Спокойный семейный маршрут вдоль реки с остановками у кафе и детских площадок"
        />

        <h2>Планетарий и звёзды</h2>
        <p>
          Звёздное небо над головой, рассказ о планетах и созвездиях. Сеансы
          идут около 45 минут — в самый раз для детей от 6 лет.
        </p>

        <hr />

        <p>
          Какой из вариантов выбрать — зависит от возраста детей и погоды. Но
          любой из них подарит воспоминания, которые останутся надолго.
        </p>

        {/* ── Final showcase ── */}
        <ArticlePlacesShowcaseBlock
          title="7 мест для семейных выходных в Минске"
          subtitle="Все места из этой статьи — в одной подборке"
          places={showcasePlaces}
          viewAllHref="/minsk/events"
          viewAllLabel="Смотреть все места"
        />
      </ArticleContent>
    </main>
  );
}
