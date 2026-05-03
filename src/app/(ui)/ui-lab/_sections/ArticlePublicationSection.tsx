"use client";

import { ArticleHeader } from "@/components/article/ArticleHeader";
import { ArticleContent } from "@/components/article/ArticleContent";
import { ArticleEventCardBlock } from "@/components/article/blocks/ArticleEventCardBlock";
import { ArticlePlaceCardBlock } from "@/components/article/blocks/ArticlePlaceCardBlock";
import { ArticleOfferCardBlock } from "@/components/article/blocks/ArticleOfferCardBlock";
import { ArticleRouteCardBlock } from "@/components/article/blocks/ArticleRouteCardBlock";
import { ArticlePlacesShowcaseBlock } from "@/components/article/blocks/ArticlePlacesShowcaseBlock";
import { ArticleFeaturedEventsBlock } from "@/components/article/blocks/ArticleFeaturedEventsBlock";

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockEvents = [
  {
    title: "Весенний фестиваль в Парке Горького",
    href: "#",
    dateLabel: "22–23 марта",
    location: "Минск, Парк Горького",
    ageLabel: "0–12 лет",
    badge: "Бесплатно",
  },
  {
    title: "Мастер-класс по керамике для детей",
    href: "#",
    dateLabel: "29 марта",
    location: "Минск, Студия «Глина»",
    ageLabel: "4–10 лет",
  },
  {
    title: "Планетарий: Звёздное небо весной",
    href: "#",
    dateLabel: "30 марта",
    location: "Минск, Планетарий",
    ageLabel: "6+ лет",
    badge: "Популярно",
  },
  {
    title: "Зоопарк: День открытых вольеров",
    href: "#",
    dateLabel: "5–6 апреля",
    location: "Минск, Зоопарк",
    ageLabel: "0+ лет",
    badge: "Бесплатно",
  },
];

const showcasePlaces = [
  { id: "1", title: "Парк Горького", href: "#", category: "Парк", location: "Минск, Центральный район" },
  { id: "2", title: "Ботанический сад", href: "#", category: "Природа", location: "Минск, Советский район" },
  { id: "3", title: "Музей природы и экологии", href: "#", category: "Музей", location: "Минск, Центральный район" },
  { id: "4", title: "Планетарий", href: "#", category: "Наука", location: "Минск" },
  { id: "5", title: "Минский зоопарк", href: "#", category: "Зоопарк", location: "Минск, Фрунзенский район" },
  { id: "6", title: "Студия керамики «Глина»", href: "#", category: "Мастер-классы", location: "Минск, Октябрьский район" },
  { id: "7", title: "Набережная Свислочи", href: "#", category: "Прогулки", location: "Минск" },
];

// ─── Typography specimen ─────────────────────────────────────────────────────

function TypographySpecimen() {
  return (
    <div className="rounded-2xl border border-border bg-white p-8 md:p-12 max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-widest text-primary mb-6 font-sans">
        Serif stack — reading typography
      </p>

      {/* H1 */}
      <div className="mb-8 pb-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-sans mb-2">H1 — Article title</p>
        <h1
          className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Как провести выходные с детьми в Минске
        </h1>
      </div>

      {/* Subtitle */}
      <div className="mb-8 pb-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-sans mb-2">Subtitle / dek — NT Somic</p>
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-sans">
          От парков до мастер-классов — собрали лучшее для семейного уикенда
        </p>
      </div>

      {/* Meta */}
      <div className="mb-8 pb-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-sans mb-2">Meta row — NT Somic</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans">
          <span className="text-primary font-medium uppercase tracking-wide text-xs">Идеи</span>
          <span className="opacity-30">·</span>
          <span>10 марта 2026</span>
          <span className="opacity-30">·</span>
          <span>5 мин чтения</span>
        </div>
      </div>

      {/* H2 */}
      <div className="mb-8 pb-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-sans mb-2">H2 — Section heading</p>
        <h2
          className="text-2xl md:text-3xl font-semibold leading-snug text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Мастер-классы: руки в дело
        </h2>
      </div>

      {/* H3 */}
      <div className="mb-8 pb-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-sans mb-2">H3 — Sub-section</p>
        <h3
          className="text-xl font-semibold leading-snug text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Как добраться и что взять с собой
        </h3>
      </div>

      {/* Body */}
      <div className="mb-8 pb-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-sans mb-2">Body text — serif 17–18px, lh 1.75</p>
        <p
          className="text-[1.0625rem] md:text-[1.125rem] leading-[1.75] md:leading-[1.8] text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Минск — город, в котором всегда есть что открыть заново. Особенно если рядом дети, которым нужны впечатления, движение и немного волшебства. Мы собрали семь идей для насыщенных выходных.
        </p>
      </div>

      {/* Blockquote */}
      <div className="mb-8 pb-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-sans mb-2">Blockquote — italic serif</p>
        <blockquote
          className="border-l-[3px] border-primary pl-5 py-1 italic text-[1.0625rem] leading-[1.75] text-muted-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Лучшие воспоминания детства — это не вещи, а моменты. Дайте детям время, пространство и немного глины.
        </blockquote>
      </div>

      {/* List */}
      <div className="mb-8 pb-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-sans mb-2">List — serif</p>
        <ul
          className="list-disc pl-5 space-y-1.5 text-[1.0625rem] leading-[1.75] text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          <li>Работает ежедневно с 10:00 до 18:00</li>
          <li>Вход для детей до 5 лет — бесплатно</li>
          <li>Есть аудиогид на русском и белорусском</li>
        </ul>
      </div>

      {/* Link */}
      <div>
        <p className="text-xs text-muted-foreground font-sans mb-2">Link — serif</p>
        <p
          className="text-[1.0625rem] leading-[1.75] text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Подробнее о маршруте читайте в нашем{" "}
          <a href="#" className="text-primary underline underline-offset-[3px] decoration-[1px] hover:decoration-2">
            гиде по набережной Свислочи
          </a>
          .
        </p>
      </div>
    </div>
  );
}

// ─── Card shell anatomy ──────────────────────────────────────────────────────

function CardShellAnatomy() {
  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-widest text-primary font-sans">
        Единый article card shell — 4 вариации
      </p>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-sans">Event card</p>
          <ArticleEventCardBlock
            title="Весенний фестиваль в Парке Горького"
            href="#"
            dateLabel="22–23 марта"
            location="Минск, Парк Горького"
            ageLabel="0–12 лет"
            badge="Бесплатно"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-sans">Place card</p>
          <ArticlePlaceCardBlock
            title="Студия керамики «Глина»"
            href="#"
            category="Мастер-классы"
            location="Минск, Октябрьский район"
            description="Гончарный круг, лепка, роспись — для детей от 4 лет"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-sans">Offer card</p>
          <ArticleOfferCardBlock
            title="Семейный абонемент в Ботанический сад"
            href="#"
            highlight="Неограниченные посещения на 3 месяца для семьи до 4 человек"
            badge="Спецпредложение"
            badgeVariant="promo"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-sans">Route card</p>
          <ArticleRouteCardBlock
            title="Велопрогулка по набережной Свислочи"
            href="#"
            city="Минск"
            stopCount={4}
            ageLabel="3+ лет"
            duration="~2 часа"
            description="Спокойный семейный маршрут вдоль реки с остановками у кафе и детских площадок"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Full demo article ───────────────────────────────────────────────────────

function DemoArticle() {
  return (
    <div className="max-w-2xl">
      <ArticleHeader
        title="Как провести выходные с детьми в Минске: 7 идей"
        subtitle="От парков до мастер-классов — собрали лучшее для семейного уикенда"
        category="Идеи"
        readTime={5}
        publishedAt="2026-03-10"
      />

      <ArticleContent>
        {/* Intro */}
        <p>
          Минск — город, в котором всегда есть что открыть заново. Особенно если
          рядом дети, которым нужны впечатления, движение и немного волшебства.
        </p>
        <p>
          Мы собрали семь идей для насыщенных выходных — от тихих прогулок в
          парке до шумных мастер-классов, где можно испачкать руки в краске и
          унести домой что-то своё.
        </p>

        {/* Early product insert — route */}
        <ArticleRouteCardBlock
          title="Велопрогулка по набережной Свислочи"
          href="#"
          city="Минск"
          stopCount={4}
          ageLabel="3+ лет"
          duration="~2 часа"
          description="Спокойный семейный маршрут вдоль реки с остановками у кафе и детских площадок"
        />

        {/* Body */}
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

        {/* Place card */}
        <ArticlePlaceCardBlock
          title="Студия керамики «Глина»"
          href="#"
          category="Мастер-классы"
          location="Минск, Октябрьский район"
          description="Гончарный круг, лепка, роспись — для детей от 4 лет"
        />

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

        {/* Featured events / mini-afisha */}
        <ArticleFeaturedEventsBlock
          title="Афиша на выходные"
          subtitle="Ближайшие события для семей с детьми"
          events={mockEvents}
          viewAllHref="#"
          viewAllLabel="Вся афиша"
        />

        <h2>Специальные предложения</h2>
        <p>
          Некоторые места предлагают семейные абонементы — это выгоднее разовых
          посещений и позволяет возвращаться снова и снова.
        </p>

        {/* Offer card */}
        <ArticleOfferCardBlock
          title="Семейный абонемент в Ботанический сад"
          href="#"
          highlight="Неограниченные посещения на 3 месяца для семьи до 4 человек"
          badge="Спецпредложение"
          badgeVariant="promo"
        />

        <h2>Ближайшее событие</h2>
        <p>
          Если хочется не просто погулять, а попасть на что-то особенное — вот
          одно из лучших событий этой весны.
        </p>

        {/* Event card */}
        <ArticleEventCardBlock
          title="Весенний фестиваль в Парке Горького"
          href="#"
          dateLabel="22–23 марта"
          location="Минск, Парк Горького"
          ageLabel="0–12 лет"
          badge="Бесплатно"
        />

        <hr />

        <p>
          Какой из вариантов выбрать — зависит от возраста детей и погоды. Но
          любой из них подарит воспоминания, которые останутся надолго.
        </p>

        {/* Final showcase */}
        <ArticlePlacesShowcaseBlock
          title="7 мест для семейных выходных в Минске"
          subtitle="Все места из этой статьи — в одной подборке"
          places={showcasePlaces}
          viewAllHref="#"
          viewAllLabel="Смотреть все места"
        />
      </ArticleContent>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function ArticlePublicationSection() {
  return (
    <section id="article-publication" className="space-y-16">
      {/* Section header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">
          Article Publication System
        </h2>
        <p className="text-muted-foreground max-w-2xl">
          Visual source of truth for <code className="text-sm bg-muted px-1.5 py-0.5 rounded">/blog</code> pages.
          Literata for long-form reading, NT Somic for product cards and UI.
          All embedded blocks share a unified article card shell.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono">
          <span className="bg-muted px-2 py-1 rounded">Literata — reading</span>
          <span className="bg-muted px-2 py-1 rounded">NT Somic — product UI</span>
          <span className="bg-muted px-2 py-1 rounded">max-w-2xl reading column</span>
          <span className="bg-muted px-2 py-1 rounded">article-body CSS class</span>
        </div>
      </div>

      {/* 1. Typography specimen */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">1. Typography System</h3>
          <p className="text-sm text-muted-foreground">
            Literata for all reading content. NT Somic for meta, subtitles, and product UI.
          </p>
        </div>
        <TypographySpecimen />
      </div>

      {/* 2. Card shell anatomy */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">2. Article Embedded Card Shell</h3>
          <p className="text-sm text-muted-foreground">
            One unified shell, four content variations. White surface, soft shadow, rounded-2xl, NT Somic inside.
          </p>
        </div>
        <CardShellAnatomy />
      </div>

      {/* 3. Featured events block */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">3. Featured Events / Mini-Afisha Block</h3>
          <p className="text-sm text-muted-foreground">
            Curated editorial insert. 2-column grid, date pills, clean meta. Used mid-article for seasonal/holiday SEO.
          </p>
        </div>
        <div className="max-w-2xl">
          <ArticleFeaturedEventsBlock
            title="Афиша на выходные"
            subtitle="Ближайшие события для семей с детьми"
            events={mockEvents}
            viewAllHref="#"
            viewAllLabel="Вся афиша"
          />
        </div>
      </div>

      {/* 4. Showcase block */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">4. Final Showcase Block — 7 Places</h3>
          <p className="text-sm text-muted-foreground">
            Curated ending section. Featured large card + 2-col compact grid. Used as article closer.
          </p>
        </div>
        <div className="max-w-2xl">
          <ArticlePlacesShowcaseBlock
            title="7 мест для семейных выходных в Минске"
            subtitle="Все места из этой статьи — в одной подборке"
            places={showcasePlaces}
            viewAllHref="#"
            viewAllLabel="Смотреть все места"
          />
        </div>
      </div>

      {/* 5. Full demo article */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">5. Full Demo Publication</h3>
          <p className="text-sm text-muted-foreground">
            Complete article flow: header → intro → route insert → body → place → afisha block → offer → event → showcase.
            This is the production template for <code className="text-xs bg-muted px-1 py-0.5 rounded">/blog/[slug]</code>.
          </p>
        </div>
        {/* Simulate page background */}
        <div className="rounded-3xl bg-background border border-border/60 px-4 sm:px-8 py-10 md:py-14">
          <DemoArticle />
        </div>
      </div>
    </section>
  );
}
