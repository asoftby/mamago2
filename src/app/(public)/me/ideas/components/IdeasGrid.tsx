import type { IdeaItem } from "../types";
import { IdeaPosterCard } from "./IdeaPosterCard";

type IdeasGridProps = {
  ideas: IdeaItem[];
  planningIdeaId: string | null;
  removingIdeaId: string | null;
  onSchedule: (ideaId: string) => void;
  onRemove: (idea: IdeaItem) => void;
  onCollection?: (ideaId: string) => void;
};

export function IdeasGrid({
  ideas,
  planningIdeaId,
  removingIdeaId,
  onSchedule,
  onRemove,
  onCollection,
}: IdeasGridProps) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 min-[720px]:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => (
        <IdeaPosterCard
          key={idea.id}
          idea={idea}
          isScheduling={planningIdeaId === idea.id}
          isRemoving={removingIdeaId === idea.id}
          onSchedule={() => onSchedule(idea.id)}
          onRemove={() => onRemove(idea)}
          onCollection={onCollection ? () => onCollection(idea.id) : undefined}
        />
      ))}
    </div>
  );
}
