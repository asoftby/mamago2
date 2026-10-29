"use client";

import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { CollectionCover } from "@/components/ideas/CollectionCover";
import { OrderedMasonryGrid } from "@/components/ideas/OrderedMasonryGrid";
import { visibleInCollection, type CollectionSummary, type CollectionMemberships } from "../collectionState";
import type { IdeaItem } from "../types";

/** CollectionCover and the "new collection" tile are 3:2 (height/width = 2/3). */
const COLLECTION_COVER_RATIO = 2 / 3;

type Props = {
  collections: CollectionSummary[];
  ideas: IdeaItem[];
  memberships: CollectionMemberships;
  onCreate: () => void;
  onManage: (id: string) => void;
};

/**
 * Only user-created collections are shown here. "Все идеи" is not a
 * collection, and a saved idea without memberships stays ungrouped.
 */
export function IdeasCollectionsBar({ collections, ideas, memberships, onCreate, onManage }: Props) {
  return (
    <section aria-label="Мои коллекции" className="min-w-0 space-y-4">
      <h2 className="text-lg font-semibold">Мои коллекции</h2>
      <OrderedMasonryGrid
        itemClassName="pb-4"
        items={[
          ...collections.map((item) => {
          const covers = ideas
            .filter((idea) => visibleInCollection(idea, item.id, memberships))
            .map((idea) => idea.activity.coverImageUrl)
            .filter((url): url is string => Boolean(url))
            .slice(0, 4);

          return {
            key: item.id,
            ratio: COLLECTION_COVER_RATIO,
            content: (
            <div className="min-w-0">
              <Link
                href={`/me/ideas/collections/${encodeURIComponent(item.id)}`}
                className="group block w-full min-w-0 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Открыть коллекцию «${item.title}»`}
              >
                <span data-masonry-media className="block">
                  <CollectionCover covers={covers} className="transition-shadow group-hover:shadow-md" />
                </span>
                <span className="mt-3 block break-words text-base font-semibold">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.count} сохранено</span>
              </Link>
              <button
                type="button"
                onClick={() => onManage(item.id)}
                aria-label={`Управлять коллекцией «${item.title}»`}
                className="mt-1 flex size-11 items-center justify-center rounded-full hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </div>
            ),
          };
        }),
          {
            key: "__new-collection",
            ratio: COLLECTION_COVER_RATIO,
            content: (
        <button
          type="button"
          onClick={onCreate}
          className="group min-w-0 self-start rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span data-masonry-media className="flex aspect-[3/2] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-muted transition-colors group-hover:bg-surface-hover">
            <Plus className="size-9 text-muted-foreground" />
          </span>
          <span className="mt-3 block text-base font-semibold">Новая коллекция</span>
        </button>
            ),
          },
        ]}
      />
    </section>
  );
}
