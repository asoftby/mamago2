"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ImportEntityType } from "@prisma/client";

type QueueStageParam = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ALL";

type ImportReviewFiltersProps = {
  sources: Array<{ id: string; name: string; slug: string }>;
  currentStage: QueueStageParam;
  currentSourceId?: string;
  currentEntityType?: ImportEntityType;
};

export function ImportReviewFilters({
  sources,
  currentStage,
  currentSourceId,
  currentEntityType,
}: ImportReviewFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const hasActiveFilters = useMemo(
    () =>
      currentStage !== "PENDING" ||
      Boolean(currentSourceId) ||
      Boolean(currentEntityType),
    [currentEntityType, currentSourceId, currentStage],
  );

  function replaceFilters(next: {
    stage?: QueueStageParam;
    sourceId?: string;
    entityType?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.stage && next.stage !== "PENDING" && next.stage !== "ALL") {
      params.set("status", next.stage);
    } else if (next.stage === "ALL") {
      params.set("status", "ALL");
    } else {
      params.delete("status");
    }

    if (next.sourceId) {
      params.set("source", next.sourceId);
    } else {
      params.delete("source");
    }

    if (next.entityType) {
      params.set("entity", next.entityType);
    } else {
      params.delete("entity");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 lg:items-end">
      <div className="flex flex-wrap gap-2">
        <select
          value={currentStage}
          onChange={(event) =>
            startTransition(() =>
              replaceFilters({
                stage: event.target.value as QueueStageParam,
                sourceId: currentSourceId,
                entityType: currentEntityType,
              }),
            )
          }
          disabled={isPending}
          className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-stone-400"
        >
          <option value="PENDING">Нужно проверить</option>
          <option value="IN_PROGRESS">В работе</option>
          <option value="COMPLETED">Решение принято</option>
          <option value="ALL">Все объекты</option>
        </select>

        <select
          value={currentSourceId ?? ""}
          onChange={(event) =>
            startTransition(() =>
              replaceFilters({
                stage: currentStage,
                sourceId: event.target.value || undefined,
                entityType: currentEntityType,
              }),
            )
          }
          disabled={isPending}
          className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-stone-400"
        >
          <option value="">Все источники</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>

        <select
          value={currentEntityType ?? ""}
          onChange={(event) =>
            startTransition(() =>
              replaceFilters({
                stage: currentStage,
                sourceId: currentSourceId,
                entityType: event.target.value || undefined,
              }),
            )
          }
          disabled={isPending}
          className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-stone-400"
        >
          <option value="">Все типы</option>
          <option value="PLACE">Места</option>
          <option value="EVENT">События</option>
          <option value="OFFER">Офферы</option>
        </select>
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() =>
            startTransition(() =>
              replaceFilters({
                stage: "PENDING",
                sourceId: undefined,
                entityType: undefined,
              }),
            )
          }
          className="text-sm font-medium text-stone-500 transition hover:text-stone-900"
        >
          Сбросить фильтры
        </button>
      ) : null}
    </div>
  );
}
