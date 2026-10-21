import type { IdeaItem } from "../types";
import { IdeaPosterCard } from "./IdeaPosterCard";
import { OrderedMasonryGrid } from "@/components/ideas/OrderedMasonryGrid";

type IdeasGridProps = {
  ideas: IdeaItem[];
  planningIdeaId: string | null;
  removingIdeaId: string | null;
  onSchedule: (ideaId: string) => void;
};

/** Ordered Pinterest-style masonry: native poster ratios, two columns mobile / four desktop. */
export function IdeasGrid({
  ideas,
  planningIdeaId,
  removingIdeaId,
  onSchedule,
}: IdeasGridProps) {
  return (
    <OrderedMasonryGrid itemClassName="pb-5 sm:pb-8">
      {ideas.map((idea) => (
        <div key={idea.id} className="min-w-0">
          <IdeaPosterCard
            idea={idea}
            isScheduling={planningIdeaId === idea.id}
            isRemoving={removingIdeaId === idea.id}
            onSchedule={() => onSchedule(idea.id)}
          />
        </div>
      ))}
    </OrderedMasonryGrid>
  );
}
