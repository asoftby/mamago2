"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { IdeaCard } from "./IdeaCard";
import type { IdeaItem, Filter } from "./types";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "UNPLANNED", label: "Не запланировано" },
  { value: "PLANNED", label: "Уже в плане" },
];

interface Props {
  initialIdeas: IdeaItem[];
}

export function IdeasClient({ initialIdeas }: Props) {
  const [ideas, setIdeas] = useState<IdeaItem[]>(initialIdeas);
  const [filter, setFilter] = useState<Filter>("ALL");

  const filtered = ideas.filter((idea) => {
    if (filter === "PLANNED") return idea.isPlanned;
    if (filter === "UNPLANNED") return !idea.isPlanned;
    return true;
  });

  function handlePlanned(ideaId: string, date: string): void {
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === ideaId ? { ...i, isPlanned: true, plannedDate: date } : i
      )
    );
  }

  function handleRemove(ideaId: string, activityId: string) {
    // Optimistic remove
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    fetch(`/api/save/idea?activityId=${activityId}`, { method: "DELETE" }).catch(
      () => {
        // Rollback on failure
        setIdeas(initialIdeas);
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Мои идеи</h1>
        <p className="text-sm text-neutral-500">
          Сохранённые активности, которые можно запланировать позже
          {ideas.length > 0 && (
            <span className="ml-2 text-neutral-400">· {ideas.length}</span>
          )}
        </p>
      </div>

      {/* Filters */}
      {ideas.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                filter === f.value
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onPlanned={(date: string) => handlePlanned(idea.id, date)}
              onRemove={() => handleRemove(idea.id, idea.activity.id)}
            />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <EmptyState />
      ) : (
        <p className="text-sm text-neutral-400 py-8 text-center">
          Нет идей в этой категории
        </p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="text-4xl">💡</div>
      <div className="space-y-1">
        <p className="text-base font-medium text-neutral-900">Пока здесь пусто</p>
        <p className="text-sm text-neutral-500">
          Сохраняйте интересные активности, чтобы вернуться к ним позже
        </p>
      </div>
      <Link
        href="/"
        className="mt-2 px-5 py-2.5 rounded-full bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
      >
        Найти идеи
      </Link>
    </div>
  );
}
