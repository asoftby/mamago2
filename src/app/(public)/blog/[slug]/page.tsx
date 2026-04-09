import { notFound, permanentRedirect } from "next/navigation";
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
import type { ArticleVm } from "@/lib/blog/articleTypes";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { loadArticleMvpBySlugPublic } from "@/lib/article/articleMvpRenderData";
import { ArticleMvpView } from "@/components/article/mvp/ArticleMvpView";
import {
  incrementPublishedArticleViews,
  shouldCountPublishedArticleViewRequest,
} from "@/lib/article/articleViews";

async function getArticle(slug: string): Promise<ArticleVm | null> {
  const resolved = await findArticleBySlug(slug);
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
  if (slug === "demo-premium-article") {
    return {
      slug,
      title: "Как провести выходные с детьми в Минске: 7 идей",
      subtitle:
        "От парков до мастер-классов — собрали лучшее для семейного уикенда",
      category: "Идеи",
      readTime: 5,
      publishedAt: "2026-03-10",
      heroImage: null,
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
  const mvp = await loadArticleMvpBySlugPublic(slug);
  if (mvp) {
    const article = await prisma.article.findUnique({
      where: { id: mvp.id },
      select: {
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoOgTitle: true,
        seoOgDescription: true,
        seoRobots: true,
        noindex: true,
      },
    });
    const title = article?.seoTitle?.trim() || `${mvp.title} — mamaGo`;
    const description = article?.seoDescription?.trim() || mvp.excerpt?.trim() || undefined;
    const ogTitle =
      article?.seoOgTitle?.trim() || article?.seoTitle?.trim() || `${mvp.title} — mamaGo`;
    const ogDescription =
      article?.seoOgDescription?.trim() ||
      article?.seoDescription?.trim() ||
      mvp.excerpt?.trim() ||
      undefined;
    const canonical = article?.seoCanonicalUrl?.trim();
    const noindex =
      article?.noindex === true ||
      (article?.seoRobots?.toLowerCase().includes("noindex") ?? false);
    return {
      title,
      description,
      alternates: canonical ? { canonical } : undefined,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        images: mvp.heroUrl ? [{ url: mvp.heroUrl }] : undefined,
      },
      robots: noindex ? { index: false, follow: false } : undefined,
    };
  }
  const article = await getArticle(slug);
  if (!article) return {};
  if ("_redirectToSlug" in article && article._redirectToSlug) {
    permanentRedirect(`/blog/${article._redirectToSlug}`);
  }
  const seo = "_seo" in article ? article._seo : undefined;
  /** Обложка (heroImage) — основной источник OG; затем seoOgImage (legacy / денорм) */
  const ogImageUrl =
    seo?.heroImage?.trim() || seo?.seoOgImage?.trim() || undefined;
  const noindexFlag =
    seo?.noindex === true || (seo?.seoRobots?.toLowerCase().includes("noindex") ?? false);
  return {
    title: seo?.seoTitle?.trim() || `${article.title} — mamaGo`,
    description: seo?.seoDescription?.trim() || article.subtitle,
    alternates: seo?.seoCanonicalUrl?.trim()
      ? { canonical: seo.seoCanonicalUrl.trim() }
      : undefined,
    openGraph: {
      title: seo?.seoOgTitle?.trim() || seo?.seoTitle?.trim() || `${article.title} — mamaGo`,
      description: seo?.seoOgDescription?.trim() || seo?.seoDescription?.trim() || article.subtitle,
      images: ogImageUrl ? [{ url: ogImageUrl }] : undefined,
    },
    robots: noindexFlag ? { index: false, follow: false } : undefined,
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
  const mvp = await loadArticleMvpBySlugPublic(slug);
  if (mvp) {
    if (await shouldCountPublishedArticleViewRequest()) {
      await incrementPublishedArticleViews(mvp.id);
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
        />
      </>
    );
  }

  const article = await getArticle(slug);
  if (!article) notFound();
  if ("_redirectToSlug" in article && article._redirectToSlug) {
    permanentRedirect(`/blog/${article._redirectToSlug}`);
  }

  const seo = "_seo" in article ? article._seo : undefined;
  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
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

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
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
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ArticleHeader
        title={article.title}
        subtitle={article.subtitle}
        category={article.category}
        readTime={article.readTime}
        publishedAt={article.publishedAt}
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
