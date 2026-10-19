"use client";

import { CollectionCover } from "@/components/ideas/CollectionCover";
import { useRef, useState } from "react";
import { Check, FolderHeart, Plus, Trash2 } from "lucide-react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Checkbox } from "@/components/ui/checkbox";
import { C } from "../theme";
import type { CollectionSummary } from "../collectionState";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit" | "manage";
  ideaTitle?: string;
  collection?: CollectionSummary | null;
  collections: CollectionSummary[];
  initialSelection: string[];
  onApply: (ids: string[]) => Promise<boolean>;
  onCreate: (title: string) => Promise<CollectionSummary | null>;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

function Inner({ mode, collection, ideaTitle, collections, initialSelection, onApply, onCreate, onRename, onDelete, onOpenChange }: Props) {
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [title, setTitle] = useState(mode === "manage" ? (collection?.title ?? "") : "");
  const [createMode, setCreateMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const inputClass = "h-12 w-full min-w-0 rounded-xl border border-border bg-white px-4 text-base text-foreground outline-none focus:border-primary";
  const buttonClass = "flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-50";

  async function submitCreate() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const created = await onCreate(trimmed);
      if (created) {
        setTitle("");
        if (mode === "edit") {
          setSelected((current) => [...current, created.id]);
          setCreateMode(false);
        } else {
          onOpenChange(false);
        }
      }
    } finally { setBusy(false); }
  }

  async function submitRename() {
    if (!collection || busy || !title.trim()) return;
    setBusy(true);
    try { if (await onRename(collection.id, title.trim())) onOpenChange(false); }
    finally { setBusy(false); }
  }

  async function submitDelete() {
    if (!collection || busy) return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setBusy(true);
    try { if (await onDelete(collection.id)) onOpenChange(false); }
    finally { setBusy(false); }
  }

  async function submitApply() {
    if (busy) return;
    setBusy(true);
    try { if (await onApply(selected)) onOpenChange(false); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-0 max-h-[min(84dvh,680px)] w-full flex-col overflow-hidden text-foreground">
      <div className="relative shrink-0 px-5 pb-3 pt-10 sm:px-6 sm:pt-7">
        <ModalCloseButton type="button" aria-label="Закрыть" onClick={() => onOpenChange(false)} className="absolute right-4 top-4" />
        <div className="mb-2 flex items-center gap-2 text-primary">
          <FolderHeart className="size-[19px]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em]">Мои идеи и коллекции</span>
        </div>
        <h2 className="pr-9 text-[24px] font-semibold leading-tight tracking-tight">
          {mode === "edit" ? "В коллекцию" : mode === "manage" ? "Управление коллекцией" : "Новая коллекция"}
        </h2>
        {mode === "edit" && ideaTitle && <p className="mt-2 line-clamp-2 text-sm" style={{ color: C.ink3 }}>{ideaTitle}</p>}
        {mode === "edit" && <p className="mt-1.5 text-xs" style={{ color: C.ink3 }}>Одна идея может быть в нескольких коллекциях.</p>}
      </div>

      {mode === "edit" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6">
          {collections.length === 0 && !createMode ? (
            <p className="py-5 text-sm" style={{ color: C.ink3 }}>Пока нет коллекций. Создайте первую для своих идей.</p>
          ) : (
            <div className="space-y-1.5">
              {collections.map((item) => {
                const checked = selected.includes(item.id);
                return (
                  <label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5"
                    style={{ borderColor: checked ? "var(--primary)" : C.line2, background: checked ? "color-mix(in srgb, var(--primary) 8%, white)" : "#fff" }}>
                    <CollectionCover covers={item.covers} className="size-14 shrink-0 rounded-xl" />
                    <Checkbox checked={checked} aria-label={item.title}
                      onCheckedChange={(value) => setSelected((current) => value === true ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                    <span className="text-xs" style={{ color: C.ink3 }}>{item.count}</span>
                  </label>
                );
              })}
            </div>
          )}
          {createMode ? (
            <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void submitCreate(); }}>
              <input className={inputClass} autoFocus value={title} maxLength={60} placeholder="Название коллекции" aria-label="Название новой коллекции" onChange={(e) => setTitle(e.target.value)} />
              <button type="submit" className="flex h-12 shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50" disabled={!title.trim() || busy}>
                <Check className="size-4" /> Создать
              </button>
            </form>
          ) : (
            <button type="button" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary" onClick={() => setCreateMode(true)}>
              <Plus className="size-4" /> Создать коллекцию
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 sm:px-6">
          <form onSubmit={(event) => { event.preventDefault(); void (mode === "manage" ? submitRename() : submitCreate()); }}>
            <label htmlFor="idea-collection-title" className="mb-2 block text-xs font-medium" style={{ color: C.ink2 }}>Название</label>
            <input id="idea-collection-title" className={inputClass} autoFocus maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Летние идеи" />
            <div className="mt-4 flex gap-2">
              <button type="button" className={`${buttonClass} flex-1 border`} style={{ borderColor: C.line2 }} onClick={() => onOpenChange(false)}>Отмена</button>
              <button type="submit" disabled={!title.trim() || busy} className={`${buttonClass} flex-1 text-white`} style={{ background: C.ink }}>
                {busy ? "Сохраняем…" : mode === "manage" ? "Переименовать" : "Создать"}
              </button>
            </div>
          </form>
          {mode === "manage" && collection && (
            <div className="mt-5 border-t py-4" style={{ borderColor: C.line }}>
              <p className="mb-2 text-xs" style={{ color: C.ink3 }}>При удалении коллекции сохранённые идеи останутся в «Моих идеях».</p>
              <button type="button" disabled={busy} onClick={() => void submitDelete()}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                <Trash2 className="size-4" /> {deleteConfirm ? "Да, удалить коллекцию" : "Удалить коллекцию"}
              </button>
              {deleteConfirm && <button type="button" className="ml-4 text-xs underline" onClick={() => setDeleteConfirm(false)}>Отмена</button>}
            </div>
          )}
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-3 shrink-0 border-t px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6" style={{ borderColor: C.line }}>
          <div className="flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className={`${buttonClass} flex-1 border`} style={{ borderColor: C.line2 }}>Отмена</button>
            <button type="button" onClick={() => void submitApply()} disabled={busy} className={`${buttonClass} flex-1 text-white`} style={{ background: C.ink }}>
              {busy ? "Сохраняем…" : "Применить"}
            </button>
          </div>
          <p className="mt-2 text-center text-xs" style={{ color: C.ink3 }}>Снимите все галочки, чтобы оставить идею без коллекции.</p>
        </div>
      )}
    </div>
  );
}

export function IdeasCollectionDialog(props: Props) {
  const dragStartY = useRef<number | null>(null);
  const dragHandle = (
    <button
      type="button"
      aria-label="Потяните вниз, чтобы закрыть"
      className="mx-auto mt-2 flex min-h-8 w-16 shrink-0 touch-none items-center justify-center rounded-full md:hidden"
      onTouchStart={(event) => { dragStartY.current = event.touches[0]?.clientY ?? null; }}
      onTouchEnd={(event) => {
        const endY = event.changedTouches[0]?.clientY;
        if (dragStartY.current != null && endY != null && endY - dragStartY.current > 56) {
          props.onOpenChange(false);
        }
        dragStartY.current = null;
      }}
      onTouchCancel={() => { dragStartY.current = null; }}
      onClick={() => props.onOpenChange(false)}
    >
      <span className="block h-1 w-12 rounded-full bg-neutral-300" />
    </button>
  );

  return (
    <ResponsiveOverlay
      open={props.open}
      onOpenChange={props.onOpenChange}
      a11yTitle="Коллекции идей"
      variant="chromeless"
      showCloseButton={false}
      mobileTopSlot={dragHandle}
      heightMode="tall"
      dialogContentClassName="!max-w-[520px]"
      sheetContentClassName="!h-auto max-h-[min(88dvh,100dvh)]"
      bodyClassName="min-h-0 overflow-hidden"
    >
      <div className="flex min-h-0 w-full flex-col bg-background motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
        <Inner {...props} />
      </div>
    </ResponsiveOverlay>
  );
}
