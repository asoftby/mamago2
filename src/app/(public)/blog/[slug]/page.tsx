import { notFound } from "next/navigation";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { ArticleContent } from "@/components/article/ArticleContent";
import { ArticleEventCardBlock } from "@/components/article/blocks/ArticleEventCardBlock";
import { ArticlePlaceCardBlock } from "@/components/article/blocks/ArticlePlaceCardBlock";
import { ArticleOfferCardBlock } from "@/components/article/blocks/ArticleOfferCardBlock";
import { ArticleRouteCardBlock } from "@/components/article/blocks/ArticleRouteCardBlock";
import { ArticlePlacesShowcaseBlock } from "@/components/article/blocks/ArticlePlacesShowcaseBlock";

async function getArticle(slug: string) {
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
  const article = await getArticle(slug);
  if (!article) return {};
  return {
    title: `${article.title} — mamaGo`,
    description: article.subtitle,
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
  const article = await getArticle(slug);
  if (!article) notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <ArticleHeader
        title={article.title}
        subtitle={article.subtitle}
        category={article.category}
        readTime={article.readTime}
        publishedAt={article.publishedAt}
        heroImage={article.heroImage ?? undefined}
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
          viewAllHref="/minsk/kuda"
          viewAllLabel="Смотреть все места"
        />
      </ArticleContent>
    </main>
  );
}
