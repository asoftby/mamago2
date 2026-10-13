"use client";

import { useEffect, useMemo, useState } from "react";
import { SaveToPlanModal } from "@/components/activity/SaveToPlanModal";
import { toast } from "@/lib/toast";
import type { IdeaItem, Filter } from "./types";
import { IdeasHeader } from "./components/IdeasHeader";
import { IdeasTabs } from "./components/IdeasTabs";
import { IdeasGrid } from "./components/IdeasGrid";
import { IdeasEmptyState } from "./components/IdeasEmptyState";
import { IdeasCollectionsBar } from "./components/IdeasCollectionsBar";
import { IdeasCollectionDialog } from "./components/IdeasCollectionDialog";
import {
  ALL_IDEAS,
  WITHOUT_COLLECTION,
  collectionTarget,
  updateCollectionCounts,
  visibleInCollection,
  type CollectionMemberships,
  type CollectionSummary,
} from "./collectionState";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "UNPLANNED", label: "Не запланировано" },
  { value: "PLANNED", label: "Уже в плане" },
];

interface Props {
  initialIdeas: IdeaItem[];
  initialCollections?: CollectionSummary[];
  initialMemberships?: CollectionMemberships;
  discoveryHref?: string;
}

type RemoveIdeaOptions = {
  silentSuccess?: boolean;
};

function ideaEntityKey(idea: IdeaItem): string {
  return `${idea.ideaType}:${idea.activity.id}`;
}

function mergeIdeas(current: IdeaItem[], incoming: IdeaItem[]): IdeaItem[] {
  const byEntity = new Map<string, IdeaItem>();
  for (const idea of [...current, ...incoming]) {
    byEntity.set(ideaEntityKey(idea), idea);
  }
  return [...byEntity.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function buildRemoveQuery(idea: IdeaItem): string {
  if (idea.ideaType === "OFFER") return `offerId=${idea.activity.id}`;
  if (idea.ideaType === "ROUTE") return `routeId=${idea.activity.id}`;
  if (idea.ideaType === "ARTICLE") return `articleId=${idea.activity.id}`;
  return `activityId=${idea.activity.id}`;
}

type CollectionDialogState =
  | { mode: "create" }
  | { mode: "edit"; ideaId: string }
  | { mode: "manage"; collectionId: string };

export function IdeasClient({ initialIdeas, initialCollections = [], initialMemberships = {}, discoveryHref = "/minsk" }: Props) {
  const [ideas, setIdeas] = useState<IdeaItem[]>(initialIdeas);
  const [collections, setCollections] = useState<CollectionSummary[]>(initialCollections);
  const [memberships, setMemberships] = useState<CollectionMemberships>(initialMemberships);
  const [collectionFilter, setCollectionFilter] = useState(ALL_IDEAS);
  const [collectionDialog, setCollectionDialog] = useState<CollectionDialogState | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [planModalId, setPlanModalId] = useState<string | null>(null);
  const [removingIdeaId, setRemovingIdeaId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadArticleIdeas() {
      try {
        const response = await fetch("/api/ideas/articles", { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { items?: IdeaItem[] };
        if (!Array.isArray(data.items) || data.items.length === 0) return;
        setIdeas((current) => mergeIdeas(current, data.items ?? []));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load article ideas:", error);
        }
      }
    }

    void loadArticleIdeas();
    return () => controller.abort();
  }, []);

  async function refreshCollections() {
    try {
      const response = await fetch("/api/collections", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { collections?: CollectionSummary[] };
      if (Array.isArray(data.collections)) setCollections(data.collections);
    } catch {
      // Keep the optimistic counts; the user can retry on the next action.
    }
  }

  async function createCollection(title: string): Promise<CollectionSummary | null> {
    try {
      const response = await fetch("/api/collections", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error === "COLLECTION_EXISTS" ? "Такая коллекция уже есть" : json.error === "COLLECTION_LIMIT" ? "Можно создать не больше 50 коллекций" : "Не удалось создать коллекцию");
        return null;
      }
      const result = (await response.json()) as { collection: { id: string; title: string } };
      const collection = { ...result.collection, count: 0 };
      setCollections((current) => [...current, collection]);
      void refreshCollections();
      toast.success("Коллекция создана");
      return collection;
    } catch {
      toast.error("Не удалось создать коллекцию");
      return null;
    }
  }

  async function renameCollection(id: string, title: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error === "COLLECTION_EXISTS" ? "Такая коллекция уже есть" : "Не удалось переименовать");
        return false;
      }
      setCollections((current) => current.map((item) => item.id === id ? { ...item, title: title.trim() } : item));
      toast.success("Коллекция переименована");
      return true;
    } catch {
      toast.error("Не удалось переименовать");
      return false;
    }
  }

  async function deleteCollection(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/collections/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete_failed");
      setCollections((current) => current.filter((item) => item.id !== id));
      setMemberships((current) => Object.fromEntries(Object.entries(current).map(([ideaId, ids]) => [ideaId, ids.filter((item) => item !== id)])));
      setCollectionFilter((current) => current === id ? ALL_IDEAS : current);
      toast.success("Коллекция удалена. Идеи сохранены.");
      return true;
    } catch {
      toast.error("Не удалось удалить коллекцию");
      return false;
    }
  }

  async function saveMembership(ids: string[]): Promise<boolean> {
    if (collectionDialog?.mode !== "edit") return false;
    const idea = ideas.find((item) => item.id === collectionDialog.ideaId);
    if (!idea) return false;
    try {
      const response = await fetch("/api/save/idea/collections", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...collectionTarget(idea), collectionIds: ids }),
      });
      if (!response.ok) throw new Error("membership_failed");
      const unique = [...new Set(ids)];
      const previous = memberships[idea.id] ?? [];
      setMemberships((current) => ({ ...current, [idea.id]: unique }));
      setCollections((current) => updateCollectionCounts(current, previous, unique));
      void refreshCollections();
      toast.success(unique.length > 0 ? "Коллекции обновлены" : "Идея без коллекции");
      return true;
    } catch {
      toast.error("Не удалось сохранить коллекции", { description: "Повторите попытку — идея не удалена" });
      return false;
    }
  }

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
        if (!visibleInCollection(idea, collectionFilter, memberships)) return false;
        if (filter === "PLANNED") return idea.isPlanned;
        if (filter === "UNPLANNED") {
          return !idea.isPlanned && idea.activity.temporalState !== "PAST";
        }
        return true;
      }),
    [filter, ideas, collectionFilter, memberships],
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
      setMemberships((current) => {
        const next = { ...current };
        delete next[idea.id];
        return next;
      });
      void refreshCollections();
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
  const editingIdea = collectionDialog?.mode === "edit"
    ? (ideas.find((idea) => idea.id === collectionDialog.ideaId) ?? null)
    : null;
  const managingCollection = collectionDialog?.mode === "manage"
    ? (collections.find((item) => item.id === collectionDialog.collectionId) ?? null)
    : null;
  const withoutCount = ideas.filter((item) => !memberships[item.id]?.length).length;
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

      <IdeasCollectionsBar
        collections={collections}
        selected={collectionFilter}
        total={ideas.length}
        withoutCount={withoutCount}
        onSelect={setCollectionFilter}
        onCreate={() => setCollectionDialog({ mode: "create" })}
        onManage={(collectionId) => setCollectionDialog({ mode: "manage", collectionId })}
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
          onCollection={(ideaId) => setCollectionDialog({ mode: "edit", ideaId })}
        />
      ) : collectionFilter !== ALL_IDEAS && ideas.length > 0 ? (
        <div className="rounded-2xl border border-neutral-200 p-8 text-center">
          <p className="text-base font-medium">В этой коллекции пока нет подходящих идей</p>
          <button type="button" className="mt-3 text-sm font-semibold underline" onClick={() => { setCollectionFilter(ALL_IDEAS); setFilter("ALL"); }}>Все идеи</button>
        </div>
      ) : (
        <IdeasEmptyState variant={emptyVariant} discoveryHref={discoveryHref} />
      )}

      {collectionDialog && (
        <IdeasCollectionDialog
          key={collectionDialog.mode === "edit" ? `edit-${collectionDialog.ideaId}` : collectionDialog.mode === "manage" ? `manage-${collectionDialog.collectionId}` : "create"}
          open={true}
          onOpenChange={(open) => { if (!open) setCollectionDialog(null); }}
          mode={collectionDialog.mode}
          ideaTitle={editingIdea?.activity.title}
          collection={managingCollection}
          collections={collections}
          initialSelection={editingIdea ? memberships[editingIdea.id] ?? [] : []}
          onApply={saveMembership}
          onCreate={createCollection}
          onRename={renameCollection}
          onDelete={deleteCollection}
        />
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
