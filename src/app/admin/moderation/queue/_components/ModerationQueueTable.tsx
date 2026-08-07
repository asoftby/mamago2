"use client";

import { useMemo, useState } from "react";
import { FileText, RefreshCw, Calendar, Tag } from "lucide-react";
import { ModerationQueueRowActions } from "./ModerationQueueRowActions";
import { TableContainer } from "@/components/ui/table";

export type ModerationQueueTableItem = {
  id: string;
  moderationId: string;
  kind: "PLACE" | "PLACE_UPDATE" | "EVENT" | "OFFER";
  title: string;
  cityName: string | null;
  businessName: string;
  submittedAtLabel: string;
  reviewHref: string;
};

function TypeCell({ kind }: { kind: ModerationQueueTableItem["kind"] }) {
  if (kind === "PLACE") {
    return (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-blue-600" />
        <span className="font-medium text-blue-600">Место</span>
      </div>
    );
  }
  if (kind === "PLACE_UPDATE") {
    return (
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-amber-600" />
        <span className="font-medium text-amber-600">Изменение</span>
      </div>
    );
  }
  if (kind === "EVENT") {
    return (
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-violet-600" />
        <span className="font-medium text-violet-600">Событие</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Tag className="h-4 w-4 text-emerald-600" />
      <span className="font-medium text-emerald-600">Предложение</span>
    </div>
  );
}

export function ModerationQueueTable({
  items,
}: {
  items: ModerationQueueTableItem[];
}) {
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  const visibleItems = useMemo(
    () =>
      items.filter((item) => !resolvedIds.includes(`${item.kind}:${item.id}`)),
    [items, resolvedIds],
  );

  const handleResolved = (rowKey: string) => {
    setResolvedIds((current) => (current.includes(rowKey) ? current : [...current, rowKey]));
  };

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
        <p className="text-lg font-medium text-stone-900">Очередь пуста</p>
        <p className="mt-2 text-sm text-stone-500">
          Сейчас нет публикаций, ожидающих решения по местам, событиям или предложениям.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <TableContainer
        minWidthClassName="min-w-[720px]"
        scrollLabel="Очередь модерации, прокручивается по горизонтали"
      >
        <table className="min-w-[900px] w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50/80">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-stone-600">Тип</th>
            <th className="px-4 py-3 text-left font-medium text-stone-600">Название</th>
            <th className="px-4 py-3 text-left font-medium text-stone-600">Город</th>
            <th className="px-4 py-3 text-left font-medium text-stone-600">Автор</th>
            <th className="px-4 py-3 text-left font-medium text-stone-600">Подано</th>
            <th className="px-4 py-3 text-left font-medium text-stone-600">Решение</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {visibleItems.map((item) => (
            <tr key={`${item.kind}-${item.id}`} className="align-top transition hover:bg-stone-50/70">
              <td className="px-4 py-3">
                <TypeCell kind={item.kind} />
              </td>
              <td className="px-4 py-3 font-medium text-stone-900">{item.title}</td>
              <td className="px-4 py-3 text-stone-600">{item.cityName || "—"}</td>
              <td className="px-4 py-3 text-stone-600">{item.businessName}</td>
              <td className="px-4 py-3 text-stone-600">{item.submittedAtLabel}</td>
              <td className="px-4 py-3">
                <ModerationQueueRowActions item={item} onResolved={handleResolved} />
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </TableContainer>
    </div>
  );
}
