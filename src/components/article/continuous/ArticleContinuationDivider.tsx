export function ArticleSectionExhausted({
  sectionName,
  journalHref,
}: {
  sectionName: string;
  journalHref: string;
}) {
  return (
    <div className="not-prose my-14 md:my-20 text-center px-2">
      <div className="flex items-center gap-3 mb-6" aria-hidden>
        <div className="h-px flex-1 bg-border/70" />
        <div className="h-1.5 w-1.5 rounded-full bg-border" />
        <div className="h-px flex-1 bg-border/70" />
      </div>
      <p className="text-base text-foreground/90 font-serif">
        Вы прочитали все материалы этого раздела
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Раздел «{sectionName}»
      </p>
      <p className="mt-5">
        <a
          href={journalHref}
          className="text-sm text-primary hover:underline underline-offset-2"
        >
          Другие разделы журнала
        </a>
      </p>
    </div>
  );
}
