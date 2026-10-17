import type { PlaceReputationOverview } from "@/lib/feedback/placeReputation";

/**
 * Place reputation is a source-separated overview, not a blended score.
 * Google Maps is visibly attributed, and the site must not imply that
 * event satisfaction is identical to venue quality.
 */
export function PlaceReputationOverviewSection({
  overview,
  showCrossSourceTotal = false,
}: {
  overview: PlaceReputationOverview;
  /** Requires verified Google Maps Platform attribution/legal approval. */
  showCrossSourceTotal?: boolean;
}) {
  const google = overview.google;
  const rows = [
    { label: "О самом месте", value: overview.direct.count, note: overview.direct.historicalCount > 0 ? `В том числе ${overview.direct.historicalCount} ранее опубликованных отзывов` : "Прямые оценки площадки" },
    { label: "На событиях", value: overview.events.count, note: "Впечатления от мероприятий здесь" },
    { label: "Об услугах", value: overview.offers.count, note: "Оценки услуг, оказанных здесь" },
  ];
  const number = (count: number) => count.toLocaleString("ru-RU");
  return (
    <section id="place-reputation" className="border-t border-border/50 bg-background py-12">
      <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 sm:px-6 lg:px-7">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Отзывы и впечатления</p>
          <h2 className="font-headline text-2xl leading-tight sm:text-3xl">Что говорят посетители</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">Здесь собраны отзывы о самом месте, посещённых мероприятиях и оказанных услугах. Источники показаны отдельно.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">Впечатления mamaGo</span>
              <strong className="text-2xl tabular-nums">{number(overview.mamaGoSignals)}</strong>
            </div>
            {rows.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-4 border-t border-border/60 pt-3">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
                </div>
                <span className="font-mono text-base tabular-nums">{number(item.value)}</span>
              </div>
            ))}
            {overview.direct.positiveShare !== null ? (
              <p className="text-sm text-muted-foreground">😍 {Math.round(overview.direct.positiveShare*100)}% положительных прямых реакций</p>
            ) : null}
            {overview.events.positiveShare !== null ? (
              <p className="text-xs text-muted-foreground">На событиях: {Math.round(overview.events.positiveShare*100)}% положительных впечатлений</p>
            ) : null}
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-card p-5">
            <div className="space-y-2">
              <p className="font-semibold" translate="no">Google Maps</p>
              {google ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-3xl">★ {google.rating.toFixed(1).replace(".",",")}</strong>
                    <span className="text-sm text-muted-foreground">{number(google.count)} оценок</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Отдельная оценка Google Maps, не включена в процент mamaGo.</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Актуальная оценка Google Maps пока недоступна.</p>
              )}
            </div>
            {google?.mapsUrl ? (
              <a className="text-sm font-medium text-primary underline underline-offset-4" href={google.mapsUrl} target="_blank" rel="noopener noreferrer">Открыть отзывы в Google Maps ↗</a>
            ) : null}
          </div>
        </div>
        {showCrossSourceTotal && google ? (
          <p className="text-sm font-medium">{number(overview.allSourceSignals)} оценок из разных источников — не уникальные посетители и не единый рейтинг.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Количество оценок mamaGo и Google Maps приведено раздельно. Один человек мог оценить несколько посещений.</p>
        )}
        {overview.topVenueTags.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Что чаще отмечают о площадке</p>
            <div className="flex flex-wrap gap-2">
              {overview.topVenueTags.map((tag)=> (
                <span key={tag.label} className="rounded-full border border-border bg-muted/40 px-3 py-2 text-sm">{tag.label} · {tag.mentions}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
