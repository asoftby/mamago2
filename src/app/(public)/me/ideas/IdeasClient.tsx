"use client";

import { useMemo, useState } from "react";
import { SaveToPlanModal } from "@/components/activity/SaveToPlanModal";
import { toast } from "@/lib/toast";
import type { IdeaItem, Filter } from "./types";
import { IdeasHeader } from "./components/IdeasHeader";
import { IdeasTabs } from "./components/IdeasTabs";
import { IdeasGrid } from "./components/IdeasGrid";
import { IdeasEmptyState } from "./components/IdeasEmptyState";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "UNPLANNED", label: "Не запланировано" },
  { value: "PLANNED", label: "Уже в плане" },
];

interface Props {
  initialIdeas: IdeaItem[];
  discoveryHref?: string;
}

type RemoveIdeaOptions = {
  silentSuccess?: boolean;
};

function buildRemoveQuery(idea: IdeaItem): string {
  if (idea.ideaType === "OFFER") return `offerId=${idea.activity.id}`;
  if (idea.ideaType === "ROUTE") return `routeId=${idea.activity.id}`;
  return `activityId=${idea.activity.id}`;
}

export function IdeasClient({ initialIdeas, discoveryHref = "/minsk" }: Props) {
  const [ideas, setIdeas] = useState<IdeaItem[]>(initialIdeas);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [planModalId, setPlanModalId] = useState<string | null>(null);
  const [removingIdeaId, setRemovingIdeaId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      ALL: ideas.length,
      UNPLANNED: ideas.filter(
        (idea) => !idea.isPlanned && idea.activity.temporalState !== "PAST",
      ).length,
      PLANNED: ideas.filter((idea) => idea.isPlanned).length,
    }),
    [ideas],
  );

  const filtered = useMemo(
    () =>
      ideas.filter((idea) => {
        if (filter === "PLANNED") return idea.isPlanned;
        if (filter === "UNPLANNED") {
          return !idea.isPlanned && idea.activity.temporalState !== "PAST";
        }
        return true;
      }),
    [filter, ideas],
  );

  const tabItems = useMemo(
    () =>
      FILTERS.map((tab) => ({
        ...tab,
        count: counts[tab.value],
      })),
    [counts],
  );

  function handlePlanned(ideaId: string, date: string): void {
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === ideaId
          ? { ...i, isPlanned: true, plannedDate: date, planStatus: "PLANNED_UPCOMING" }
          : i,
      )
    );
  }

  async function handleRemove(idea: IdeaItem, options: RemoveIdeaOptions = {}) {
    const previousIdeas = ideas;
    const query = buildRemoveQuery(idea);

    setRemovingIdeaId(idea.id);
    setIdeas((prev) => prev.filter((item) => item.id !== idea.id));

    try {
      const response = await fetch(`/api/save/idea?${query}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("remove_failed");
      }
      if (!options.silentSuccess) {
        toast.success("Удалено из идей");
      }
    } catch {
      setIdeas(previousIdeas);
      toast.error("Не удалось удалить из идей", {
        description: "Попробуйте ещё раз",
      });
    } finally {
      setRemovingIdeaId((current) => (current === idea.id ? null : current));
    }
  }

  const planningIdea = ideas.find((i) => i.id === planModalId) ?? null;
  const emptyVariant =
    ideas.length === 0
      ? "INITIAL"
      : filter === "UNPLANNED"
        ? "UNPLANNED"
        : "PLANNED";

  return (
    <div className="space-y-6 sm:space-y-8">
      <IdeasHeader
        totalCount={ideas.length}
        plannedCount={counts.PLANNED}
        unplannedCount={counts.UNPLANNED}
      />

      {ideas.length > 0 ? (
        <IdeasTabs value={filter} items={tabItems} onChange={setFilter} />
      ) : null}

      {filtered.length > 0 ? (
        <IdeasGrid
          ideas={filtered}
          planningIdeaId={planModalId}
          removingIdeaId={removingIdeaId}
          onSchedule={setPlanModalId}
          onRemove={handleRemove}
        />
      ) : (
        <IdeasEmptyState variant={emptyVariant} discoveryHref={discoveryHref} />
      )}

      <SaveToPlanModal
        open={planModalId !== null}
        onOpenChange={(open) => {
          if (!open) setPlanModalId(null);
        }}
        scenario={{
          kind: "quickdate",
          title: planningIdea?.activity.title ?? "",
          eventPlanDateISO: planningIdea?.activity.dateStart ?? undefined,
          eventPlanDateEndISO: planningIdea?.activity.dateEnd ?? undefined,
        }}
        isIdea={true}
        inPlan={planningIdea?.isPlanned ?? false}
        planDate={planningIdea?.plannedDate ?? null}
        source="ideas"
        onConfirm={(result) => {
          if (result.action === "plan" && result.dateISO && planModalId) {
            handlePlanned(planModalId, result.dateISO);
          } else if (result.action === "remove-idea" && planningIdea) {
            void handleRemove(planningIdea, { silentSuccess: true });
          }
          setPlanModalId(null);
        }}
      />
    </div>
  );
}
