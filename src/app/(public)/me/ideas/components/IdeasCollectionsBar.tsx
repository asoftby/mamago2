"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { CollectionCover } from "@/components/ideas/CollectionCover";
import { cn } from "@/lib/utils";
import { ALL_IDEAS, WITHOUT_COLLECTION, visibleInCollection, type CollectionSummary, type CollectionMemberships } from "../collectionState";
import type { IdeaItem } from "../types";

type Props = {
  collections: CollectionSummary[];
  ideas: IdeaItem[];
  memberships: CollectionMemberships;
  selected: string;
  total: number;
  withoutCount: number;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onManage: (id: string) => void;
};

export function IdeasCollectionsBar({ collections, ideas, memberships, selected, total, withoutCount, onSelect, onCreate, onManage }: Props) {
  const entries = [
    { id: ALL_IDEAS, title: "Все идеи", count: total },
    { id: WITHOUT_COLLECTION, title: "Без коллекции", count: withoutCount },
    ...collections,
  ];
  return (
    <section aria-label="Мои коллекции" className="space-y-4">
      <h2 className="text-lg font-semibold">Мои доски</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((item) => {
          const covers = ideas.filter((idea) => visibleInCollection(idea, item.id, memberships))
            .map((idea) => idea.activity.coverImageUrl).filter((url): url is string => Boolean(url)).slice(0, 4);
          const named = item.id !== ALL_IDEAS && item.id !== WITHOUT_COLLECTION;
          return (
            <div key={item.id} className="min-w-0">
              <button type="button" aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}
                className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
                <CollectionCover covers={covers} className={cn("transition-shadow group-hover:shadow-md",
                  selected === item.id && "ring-2 ring-stone-900 ring-offset-4")} />
                <span className="mt-3 block truncate text-base font-semibold">{item.title}</span>
                <span className="text-xs text-stone-500">{item.count} сохранено</span>
              </button>
              {named && <button type="button" onClick={() => onManage(item.id)} aria-label={`Управлять коллекцией «${item.title}»`}
                className="mt-1 flex min-h-9 min-w-9 items-center justify-center rounded-full hover:bg-stone-100"><MoreHorizontal className="size-5" /></button>}
            </div>
          );
        })}
        <button type="button" onClick={onCreate} className="group self-start text-left">
          <span className="flex aspect-[3/2] items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 transition-colors group-hover:bg-stone-100"><Plus className="size-9 text-stone-400" /></span>
          <span className="mt-3 block text-base font-semibold">Новая доска</span>
        </button>
      </div>
    </section>
  );
}
