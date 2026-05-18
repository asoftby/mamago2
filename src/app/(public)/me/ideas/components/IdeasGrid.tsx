import type { ActivityFormat } from "@prisma/client";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { OfferCard } from "@/components/offers/OfferCard";
import { RouteCard } from "@/components/routes/RouteCard";
import type { PublicRouteCardModel } from "@/components/routes/types";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";
import type { IdeaItem } from "../types";
import { IdeaCardActions } from "./IdeaCardActions";

function buildRouteModel(idea: IdeaItem): PublicRouteCardModel {
  const href = idea.activity.publicHref ?? "";
  const slug = href.split("/").filter(Boolean).at(-1) ?? idea.activity.id;

  return {
    id: idea.activity.id,
    slug,
    title: idea.activity.title,
    ageTags: [],
    budgetLevel: "FREE",
    cityName: idea.activity.placeTitle ?? "Минск",
    coverImageUrl: idea.activity.coverImageUrl ?? "",
    authorName: null,
    isEditorial: false,
    stopsCount: 0,
    stops: [],
  };
}

type IdeasGridProps = {
  ideas: IdeaItem[];
  planningIdeaId: string | null;
  removingIdeaId: string | null;
  onSchedule: (ideaId: string) => void;
  onRemove: (idea: IdeaItem) => void;
};

export function IdeasGrid({
  ideas,
  planningIdeaId,
  removingIdeaId,
  onSchedule,
  onRemove,
}: IdeasGridProps) {
  return (
    <div className="grid grid-cols-1 justify-items-center gap-x-4 gap-y-8 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {ideas.map((idea) => {
        const activity = idea.activity;
        const isRemoving = removingIdeaId === idea.id;
        const isScheduling = planningIdeaId === idea.id;
        const isFreeByText =
          typeof activity.priceText === "string" &&
          activity.priceText.toLowerCase().includes("бесплатно");
        const priceMin =
          activity.priceFrom != null
            ? activity.priceFrom
            : isFreeByText
              ? 0
              : undefined;
        const ageBounds =
          idea.ideaType === "ACTIVITY"
            ? ageBoundsFromActivityFields({
                ageTags: activity.ageTags ?? [],
                ageMinMonths: activity.ageMinMonths,
                ageMaxMonths: activity.ageMaxMonths,
              })
            : null;
        const ageFrom = ageBounds?.ageFrom;
        const routeModel =
          idea.ideaType === "ROUTE" ? buildRouteModel(idea) : null;

        return (
          <div key={idea.id} className="w-full max-w-[230px] sm:max-w-[250px]">
            <div className="space-y-3">
              {idea.ideaType === "ACTIVITY" ? (
                <ActivityCard
                  activity={{
                    id: activity.id,
                    slug: activity.slug ?? null,
                    citySlug: activity.citySlug ?? null,
                    href: activity.publicHref ?? undefined,
                    format: (activity.format as ActivityFormat) ?? null,
                    title: activity.title,
                    image: activity.coverImageUrl ?? "",
                    ageFrom,
                    dateStart: activity.dateStart ?? null,
                    dateEnd: activity.dateEnd ?? null,
                    priceMin,
                    priceMax: activity.priceMax ?? undefined,
                    priceListUsesOt: activity.priceListUsesOt ?? undefined,
                    currency: (activity.currency as "BYN" | null) ?? null,
                  }}
                  saveMeta={{
                    title: activity.title,
                    dateISO: activity.dateStart ?? null,
                    dateEndISO: activity.dateEnd ?? null,
                    dateLabel: activity.dateStart
                      ? formatRuShortDayMonth(activity.dateStart)
                      : null,
                    source: "ideas",
                  }}
                />
              ) : idea.ideaType === "OFFER" ? (
                <OfferCard
                  id={activity.id}
                  title={activity.title}
                  href={activity.publicHref ?? "#"}
                  imageUrl={activity.coverImageUrl ?? undefined}
                  categoryLabel={activity.categoryLabel ?? undefined}
                  dateLabel={activity.dateLabel ?? undefined}
                  priceLabel={activity.priceText?.trim() || undefined}
                  saveDateISO={activity.dateStart ?? null}
                  saveDateEndISO={activity.dateEnd ?? null}
                  saveSource="ideas"
                />
              ) : routeModel ? (
                <RouteCard route={routeModel} />
              ) : null}

              <div className="px-1">
                <IdeaCardActions
                  isPlanned={idea.isPlanned}
                  onSchedule={() => onSchedule(idea.id)}
                  onRemove={() => onRemove(idea)}
                  isScheduling={isScheduling}
                  isRemoving={isRemoving}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
