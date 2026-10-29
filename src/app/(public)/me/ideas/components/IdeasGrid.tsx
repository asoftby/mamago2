import type { IdeaItem } from "../types";
import { IdeaPosterCard } from "./IdeaPosterCard";
import { OrderedMasonryGrid } from "@/components/ideas/OrderedMasonryGrid";
import { resolvePosterFrame } from "@/lib/media/posterFrame";

type IdeasGridProps = {
  ideas: IdeaItem[];
  planningIdeaId: string | null;
  removingIdeaId: string | null;
  onSchedule: (ideaId: string) => void;
};

/** Ordered shortest-column masonry: poster ratios (16:9…2:3), 2/3/4 columns. */
export function IdeasGrid({
  ideas,
  planningIdeaId,
  removingIdeaId,
  onSchedule,
}: IdeasGridProps) {
  return (
    <OrderedMasonryGrid
      itemClassName="pb-2 sm:pb-4"
      items={ideas.map((idea) => ({
        key: idea.id,
        ratio: resolvePosterFrame(idea.activity.imageWidth, idea.activity.imageHeight).ratio,
        content: (
          <IdeaPosterCard
            idea={idea}
            isScheduling={planningIdeaId === idea.id}
            isRemoving={removingIdeaId === idea.id}
            onSchedule={() => onSchedule(idea.id)}
          />
        ),
      }))}
    />
  );
}
