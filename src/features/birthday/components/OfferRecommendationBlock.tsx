import { cn } from "@/lib/utils";
import type { PersonalRecommendation } from "../builder/lib/offerPersonalRecommendation";

type Props = PersonalRecommendation & {
  className?: string;
};

/**
 * Единый блок «умной подсказки» под названием карточки (площадка, доп. услуга, список в шагах).
 */
/** Типографика как у `.article-body blockquote` в статьях (Literata + italic). */
export function OfferRecommendationBlock({ first, second, className }: Props) {
  return (
    <div
      className={cn(
        "mt-2 rounded-[11px] bg-primary/5 px-2.5 py-2.5 font-serif text-[0.733rem] font-normal italic leading-[1.125] text-muted-foreground md:text-[0.776rem] md:leading-[1.1625]",
        className,
      )}
    >
      <p className="mb-0">{first}</p>
      {second ? <p className="mb-0 mt-[0.1875rem]">{second}</p> : null}
    </div>
  );
}
