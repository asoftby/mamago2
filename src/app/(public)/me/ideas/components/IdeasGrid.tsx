import type { IdeaItem } from "../types";
import { IdeaPosterCard } from "./IdeaPosterCard";

type IdeasGridProps = {
  ideas: IdeaItem[];
  planningIdeaId: string | null;
  removingIdeaId: string | null;
  onSchedule: (ideaId: string) => void;
  onRemove: (idea: IdeaItem) => void;
  onCollection?: (ideaId: string) => void;
  variant?: "unsorted" | "collection";
};

/** Two columns on mobile and four on desktop. */
export function IdeasGrid({
  ideas,
  planningIdeaId,
  removingIdeaId,
  onSchedule,
  onRemove,
  onCollection,
  variant = "collection",
}: IdeasGridProps) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
      {ideas.map((idea) => (
        <IdeaPosterCard
          key={idea.id}
          idea={idea}
          compact
          unsorted={variant === "unsorted"}
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
