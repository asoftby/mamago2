"use client";

import { CollectionCover } from "@/components/ideas/CollectionCover";
import * as React from "react";
import { ArrowLeft, Check, FolderHeart, Plus } from "lucide-react";
import type { IdeaCollectionSelection, IdeaCollectionTarget } from "@/features/save/persistIdeaCollectionSelection";

type Collection = { id: string; title: string; count: number; covers?: string[] };
type Props = {
  title: string;
  isIdea: boolean;
  target?: IdeaCollectionTarget;
  onBack: () => void;
  onApply: (selection: IdeaCollectionSelection) => void | Promise<void>;
};

/** The second slide of the shared Save dialog. An idea belongs to My Ideas
 * whether it has zero, one or several collection memberships. */
export function IdeaCollectionStep({ title, isIdea, target, onBack, onApply }: Props) {
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [guest, setGuest] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/collections", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          setGuest(true);
          return;
        }
        if (!response.ok) throw new Error("collections_load_failed");
        const data = (await response.json()) as { collections?: Collection[] };
        if (controller.signal.aborted) return;
        setCollections(Array.isArray(data.collections) ? data.collections : []);
        if (isIdea && target && Object.values(target).some(Boolean)) {
          const url = new URLSearchParams(Object.entries(target).filter(([, v]) => Boolean(v)) as [string, string][]);
          const membership = await fetch("/api/save/idea/collections?" + url, { cache: "no-store", signal: controller.signal });
          if (!membership.ok) throw new Error("memberships_load_failed");
          const json = (await membership.json()) as { collectionIds?: string[] };
          if (!controller.signal.aborted) setSelected(Array.isArray(json.collectionIds) ? json.collectionIds : []);
        }
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [isIdea, target?.activityId, target?.offerId, target?.routeId, target?.placeId, target?.articleId]);

  const trimmed = newTitle.trim();
  const selectionIsEmpty = selected.length === 0 && !trimmed;
  const submit = async (withoutCollection = false) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onApply({
        collectionIds: withoutCollection ? [] : selected,
        newCollectionTitle: withoutCollection ? undefined : trimmed || undefined,
        syncCollections: isIdea,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stp-collection-slide flex min-h-[315px] flex-col text-[#141210]" aria-label="Шаг 2. Выбор коллекции">
      <style>{`
        @keyframes stp-collection-enter { from { transform: translateX(48px); opacity: .45; } to { transform: translateX(0); opacity: 1; } }
        @media (prefers-reduced-motion: no-preference) {
          .stp-collection-slide { animation: stp-collection-enter .26s ease-out both; }
        }
      `}</style>
      <div className="shrink-0 px-6 pt-5">
        <button type="button" className="mb-3 inline-flex min-h-9 items-center gap-2 text-[13px] font-medium text-[#6F6860] hover:text-[#141210]" onClick={onBack}>
          <ArrowLeft className="size-4" /> Назад
        </button>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <FolderHeart className="size-[19px]" />
          <span className="font-mono text-[10px] uppercase tracking-[.12em]">Мои идеи · шаг 2</span>
        </div>
        <h2 className="text-[28px] font-semibold leading-[1.07] tracking-[-.025em]">Куда сохранить?</h2>
        <p className="mt-2 line-clamp-2 text-[13px] text-[#706A65]">{title}</p>
      </div>
      <div className="mt-4 max-h-[min(45vh,350px)] min-h-0 flex-1 space-y-2 overflow-y-auto px-6 pb-3">
        <button type="button" className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-[rgba(20,18,16,.14)] bg-[#FAF7F1] px-4 text-left hover:border-primary" onClick={() => void submit(true)} disabled={submitting || (isIdea && loadError)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-primary"><Check className="size-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Без коллекции</span>
            <span className="block text-[12px] text-[#706A65]">Сохранить в «Моих идеях»</span>
          </span>
        </button>
        {loading && <p role="status" className="py-3 text-[13px] text-[#706A65]">Загружаем коллекции…</p>}
        {loadError && <p role="alert" className="py-3 text-[13px] text-red-700">Не удалось загрузить коллекции. Вернитесь назад и попробуйте ещё раз.</p>}
        {guest && <p className="py-2 text-[12px] text-[#706A65]">После входа вы сможете пользоваться своими коллекциями. Новую можно назвать сейчас.</p>}
        {!loading && collections.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-medium uppercase tracking-[.1em] text-[#706A65]">Мои коллекции</p>
            {collections.map((item) => {
              const checked = selected.includes(item.id);
              return (
                <label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5" style={{ background: checked ? "color-mix(in srgb, var(--primary) 10%, white)" : "#fff", borderColor: checked ? "var(--primary)" : "rgba(20,18,16,.16)" }}>
                  <CollectionCover covers={item.covers} className="size-14 shrink-0 rounded-xl" />
                  <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={(e) => setSelected((value) => e.target.checked ? [...new Set([...value, item.id])] : value.filter((id) => id !== item.id))} aria-label={item.title} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{item.title}</span>
                  <span className="text-[12px] text-[#706A65]">{item.count}</span>
                </label>
              );
            })}
          </div>
        )}
        {creating ? (
          <div className="rounded-2xl border border-[rgba(20,18,16,.14)] bg-[#FAF7F1] p-3">
            <label htmlFor="stp-new-collection" className="mb-1 block text-[12px] font-medium">Название новой коллекции</label>
            <input id="stp-new-collection" autoFocus maxLength={60} value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Например, Идеи на выходные"
              className="h-11 w-full rounded-xl border border-[rgba(20,18,16,.2)] bg-white px-3 text-[14px] outline-none focus:border-primary" />
            <button type="button" className="mt-2 text-[12px] font-medium text-[#706A65]" onClick={() => { setCreating(false); setNewTitle(""); }}>Отмена</button>
          </div>
        ) : (
          <button type="button" className="flex min-h-11 items-center gap-2 text-[14px] font-semibold text-primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Создать коллекцию
          </button>
        )}
      </div>
      <div className="shrink-0 border-t border-[rgba(20,18,16,.1)] px-6 pb-6 pt-4">
        <button type="button" disabled={loading || loadError || submitting || (creating && !trimmed)}
          onClick={() => void submit()}
          className="flex h-12 w-full items-center justify-center rounded-full bg-[#141210] text-[14px] font-semibold text-white transition-colors hover:bg-[#3A332B] disabled:opacity-40">
          {submitting ? "Сохраняем…" : isIdea ? "Применить" : selectionIsEmpty ? "Сохранить в идеи" : "Сохранить"}
        </button>
        <p className="mt-2 text-center text-[12px] text-[#706A65]">Идея останется в «Моих идеях» даже без коллекции.</p>
      </div>
    </div>
  );
}
