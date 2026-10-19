import type { IdeaItem } from "../types";
import { IdeaPosterCard } from "./IdeaPosterCard";

type IdeasGridProps = {
  ideas: IdeaItem[];
  planningIdeaId: string | null;
  removingIdeaId: string | null;
  onSchedule: (ideaId: string) => void;
};

/** Pinterest-style masonry: native poster ratios, two columns mobile / four desktop. */
export function IdeasGrid({
  ideas,
  planningIdeaId,
  removingIdeaId,
  onSchedule,
}: IdeasGridProps) {
  return (
    <div className="w-full min-w-0 columns-2 gap-x-3 sm:gap-x-6 lg:columns-4">
      {ideas.map((idea) => (
        <div key={idea.id} className="mb-7 break-inside-avoid sm:mb-10">
          <IdeaPosterCard
            idea={idea}
            isScheduling={planningIdeaId === idea.id}
            isRemoving={removingIdeaId === idea.id}
            onSchedule={() => onSchedule(idea.id)}
          />
        </div>
      ))}
    </div>
  );
}
