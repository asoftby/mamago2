import Link from "next/link";

export const metadata = {
  title: "Журнал — mamaGo",
  description: "Идеи для прогулок, маршруты и советы для семей с детьми",
};

const articles: Array<{
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  readTime: number;
}> = [];

export default function BlogPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-widest text-primary mb-2">
          Журнал
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          Идеи и маршруты
        </h1>
        <p className="mt-3 text-muted-foreground text-base md:text-lg">
          Вдохновение для семейных прогулок, событий и открытий
        </p>
      </div>

      <div className="divide-y divide-border">
        {articles.length === 0 ? (
          <p className="py-7 text-sm text-muted-foreground">
            В журнале пока нет опубликованных статей.
          </p>
        ) : articles.map((a) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className="group flex flex-col gap-2 py-7 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
              <span className="text-primary font-medium uppercase tracking-wide">
                {a.category}
              </span>
              <span>·</span>
              <span>{a.readTime} мин</span>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
              {a.title}
            </h2>
            {a.subtitle && (
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                {a.subtitle}
              </p>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-primary mt-1">
              Читать
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
