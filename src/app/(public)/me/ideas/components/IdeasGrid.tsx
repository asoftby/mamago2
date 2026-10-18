import type { IdeaItem } from "../types";
import { IdeaPosterCard } from "./IdeaPosterCard";

type IdeasGridProps = {
  ideas: IdeaItem[];
  planningIdeaId: string | null;
  removingIdeaId: string | null;
  onSchedule: (ideaId: string) => void;
  onRemove: (idea: IdeaItem) => void;
  onCollection?: (ideaId: string) => void;
  columns?: "default" | "two";
};

export function IdeasGrid({
  ideas,
  planningIdeaId,
  removingIdeaId,
  onSchedule,
  onRemove,
  onCollection,
  columns = "default",
}: IdeasGridProps) {
  return (
    <div className={columns === "two" ? "grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-6 sm:gap-y-10" : "grid grid-cols-1 gap-x-6 gap-y-10 min-[720px]:grid-cols-2 lg:grid-cols-3"}>
      {ideas.map((idea) => (
        <IdeaPosterCard
          key={idea.id}
          idea={idea}
          compact={columns === "two"}
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
