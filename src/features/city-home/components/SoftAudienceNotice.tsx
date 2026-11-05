import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EVENT_CARD_SHELL } from "@/components/events";

/** First carousel/grid item when a selected audience has no verified matches. */
export function SoftAudienceNotice({ label = "варианты", inGrid = false, afterMatches = false, noAlternatives = false, actionHref, actionLabel }: {
  label?: string;
  inGrid?: boolean;
  afterMatches?: boolean;
  noAlternatives?: boolean;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className={inGrid ? "w-full" : EVENT_CARD_SHELL} role="status">
      <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-border/70 bg-card px-5 text-center">
        <p className="text-base font-semibold leading-snug text-foreground">
          {afterMatches ? "Больше под ваш запрос результатов нет" : noAlternatives ? "По вашему запросу мы ничего не нашли" : "По выбранным параметрам пока нет точных совпадений"}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {noAlternatives ? "Попробуйте другие варианты" : `Справа — другие ${label}, которые могут вас заинтересовать.`}
        </p>
        {noAlternatives && actionHref && actionLabel && (
          <Link href={actionHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {actionLabel} <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
        {!noAlternatives && <ArrowRight className="size-6 text-primary" aria-hidden="true" />}
      </div>
    </div>
  );
}
