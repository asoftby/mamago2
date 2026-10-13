"use client";

import { FolderHeart, FolderPlus, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { C } from "../theme";
import { ALL_IDEAS, WITHOUT_COLLECTION, type CollectionSummary } from "../collectionState";

type Props = {
  collections: CollectionSummary[];
  selected: string;
  total: number;
  withoutCount: number;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onManage: (id: string) => void;
};

export function IdeasCollectionsBar({ collections, selected, total, withoutCount, onSelect, onCreate, onManage }: Props) {
  const entries = [
    { id: ALL_IDEAS, title: "Все идеи", count: total },
    { id: WITHOUT_COLLECTION, title: "Без коллекции", count: withoutCount },
    ...collections,
  ];
  return (
    <section aria-label="Мои коллекции" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2" style={{ color: C.ink }}>
          <FolderHeart className="size-[19px]" aria-hidden="true" />
          <h2 className="text-[17px] font-semibold">Коллекции</h2>
        </div>
        <button type="button" onClick={onCreate}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors hover:bg-neutral-50"
          style={{ borderColor: C.line2, color: C.ink }}>
          <Plus className="size-4" /> Новая коллекция
        </button>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2 pb-1">
          {entries.map((item) => {
            const active = selected === item.id;
            const isNamed = item.id !== ALL_IDEAS && item.id !== WITHOUT_COLLECTION;
            return (
              <div key={item.id} className="inline-flex overflow-hidden rounded-full border"
                style={{ borderColor: active ? C.ink : C.line2, background: active ? C.ink : C.paper }}>
                <button type="button" onClick={() => onSelect(item.id)}
                  aria-pressed={active}
                  className={cn("inline-flex min-h-[42px] items-center gap-2 px-4 text-[13px] font-medium transition-colors")}
                  style={{ color: active ? C.paper : C.ink2 }}>
                  {isNamed && <FolderPlus aria-hidden="true" className="size-4" />}
                  <span>{item.title}</span>
                  <span className="font-mono text-[11px]" style={{ opacity: 0.65 }}>{item.count}</span>
                </button>
                {isNamed && (
                  <button type="button" onClick={() => onManage(item.id)}
                    className="flex w-8 min-h-[42px] items-center justify-center border-l transition-colors"
                    style={{ color: active ? C.paper : C.ink3, borderColor: active ? "rgba(255,255,255,.18)" : C.line2 }}
                    aria-label={`Управлять коллекцией «${item.title}»`} title="Переименовать или удалить">
                    <MoreHorizontal className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
