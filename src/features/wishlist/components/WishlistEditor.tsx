"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import type { WishlistItemView, WishlistView } from "@/server/wishlist/wishlist.service";
import {
  formatEventDate,
  itemStateLabel,
  parseQuickLine,
  wishlistErrorMessage,
} from "@/features/wishlist/lib/wishlistView";

type ApiResult = { ok: boolean; status: number; data: Record<string, unknown> };

async function call(url: string, method: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50";
const field =
  "min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 md:text-sm";

type ReservedConflict = {
  itemId: string;
  action: "update" | "remove";
  patch?: Record<string, unknown>;
  reservers: Array<{ displayName: string; hasContact: boolean }>;
  reservedCount: number;
};

export function WishlistEditor({ initial }: { initial: WishlistView }) {
  const [wishlist, setWishlist] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [quickLine, setQuickLine] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [quickQty, setQuickQty] = useState("1");
  const [conflict, setConflict] = useState<ReservedConflict | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const archived = wishlist.status === "ARCHIVED";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function copyForNextYear() {
    setBusy(true);
    try {
      const res = await call(`/api/wishlists/${wishlist.id}/copy`, "POST");
      const created = res.data.wishlist as WishlistView | undefined;
      if (res.ok && created) {
        toast.success("Копия создана. Бронирований в ней нет.");
        window.location.assign(`/me/wishlists/${created.id}`);
        return;
      }
      toast.error(wishlistErrorMessage(res.data.error as string | undefined));
    } finally {
      setBusy(false);
    }
  }

  async function thankGuests() {
    if (!window.confirm("Отправить «Спасибо» всем, кто взял подарок и оставил контакт или вошёл в аккаунт?")) return;
    setBusy(true);
    try {
      const res = await call(`/api/wishlists/${wishlist.id}/thanks`, "POST", {});
      if (!res.ok) {
        toast.error(wishlistErrorMessage(res.data.error as string | undefined));
        return;
      }
      const n = res.data.notified;
      toast.success(typeof n === "number" ? `Спасибо отправлено: ${n}` : "Спасибо отправлено");
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<ApiResult>, onOk?: (data: Record<string, unknown>) => void) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok && res.data.wishlist) {
        setWishlist(res.data.wishlist as WishlistView);
        onOk?.(res.data);
      } else if (!res.ok) {
        toast.error(wishlistErrorMessage(res.data.error as string | undefined));
      }
      return res;
    } finally {
      setBusy(false);
    }
  }

  /** Pulls photo/title from the item's link; a blocked shop just leaves the manual fields. */
  async function loadPreview(itemId: string) {
    const res = await call(`/api/wishlists/${wishlist.id}/items/${itemId}/preview`, "POST");
    if (res.ok && res.data.wishlist) {
      setWishlist(res.data.wishlist as WishlistView);
      if (res.data.preview === "unavailable") {
        toast.message("Не удалось получить фото по ссылке. Название и фото можно указать вручную.");
      }
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const { title, url } = parseQuickLine(quickLine);
    if (!title) return;
    const price = quickPrice.trim() ? Number(quickPrice.replace(",", ".")) : null;
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      toast.error("Проверьте цену.");
      return;
    }
    const knownIds = new Set(wishlist.items.map((i) => i.id));
    await run(
      () =>
        call(`/api/wishlists/${wishlist.id}/items`, "POST", {
          title,
          url,
          priceApprox: price,
          quantity: Math.min(99, Math.max(1, Number.parseInt(quickQty, 10) || 1)),
        }),
      (data) => {
        setQuickLine("");
        setQuickPrice("");
        setQuickQty("1");
        if (url) {
          const created = (data.wishlist as WishlistView).items.find((i) => !knownIds.has(i.id));
          if (created) void loadPreview(created.id);
        }
      },
    );
  }

  async function patchWishlist(patch: Record<string, unknown>) {
    await run(() => call(`/api/wishlists/${wishlist.id}`, "PATCH", patch));
  }

  async function patchItem(itemId: string, patch: Record<string, unknown>, confirmReserved = false) {
    const res = await run(() =>
      call(`/api/wishlists/${wishlist.id}/items/${itemId}`, "PATCH", { ...patch, confirmReserved: confirmReserved || undefined }),
    );
    if (res.status === 409 && res.data.error === "item_reserved") {
      const details = (res.data.details ?? {}) as Partial<ReservedConflict>;
      setConflict({
        itemId,
        action: "update",
        patch,
        reservers: details.reservers ?? [],
        reservedCount: details.reservedCount ?? 0,
      });
    } else if (res.ok) {
      setEditingId(null);
      const before = wishlist.items.find((i) => i.id === itemId)?.url ?? null;
      if (typeof patch.url === "string" && patch.url && patch.url !== before) void loadPreview(itemId);
    }
  }

  async function removeItem(itemId: string, confirmReserved = false) {
    const res = await run(() =>
      call(`/api/wishlists/${wishlist.id}/items/${itemId}${confirmReserved ? "?confirmReserved=1" : ""}`, "DELETE"),
    );
    if (res.status === 409 && res.data.error === "item_reserved") {
      const details = (res.data.details ?? {}) as Partial<ReservedConflict>;
      setConflict({
        itemId,
        action: "remove",
        reservers: details.reservers ?? [],
        reservedCount: details.reservedCount ?? 0,
      });
    }
  }

  async function releaseReservation(reservationId: string) {
    if (!window.confirm("Снять бронь? Подарок снова станет свободным.")) return;
    await run(() => call(`/api/wishlists/${wishlist.id}/reservations/${reservationId}`, "DELETE"));
  }

  async function confirmConflict() {
    if (!conflict) return;
    const current = conflict;
    setConflict(null);
    if (current.action === "remove") await removeItem(current.itemId, true);
    else await patchItem(current.itemId, current.patch ?? {}, true);
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = wishlist.items.findIndex((i) => i.id === active.id);
    const to = wishlist.items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    const previous = wishlist;
    const items = arrayMove(wishlist.items, from, to);
    setWishlist({ ...wishlist, items });
    const res = await call(`/api/wishlists/${wishlist.id}/items/reorder`, "POST", { itemIds: items.map((i) => i.id) });
    if (res.ok && res.data.wishlist) setWishlist(res.data.wishlist as WishlistView);
    else {
      setWishlist(previous);
      toast.error(wishlistErrorMessage(res.data.error as string | undefined));
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}${wishlist.sharePath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      window.prompt("Скопируйте ссылку", url);
    }
  }

  async function rotateLink() {
    if (!window.confirm("Старая ссылка перестанет работать. Брони сохранятся. Выпустить новую?")) return;
    await run(() => call(`/api/wishlists/${wishlist.id}/rotate-link`, "POST"), () => toast.success("Новая ссылка готова"));
  }

  const dateLabel = formatEventDate(wishlist.eventDate);
  const shared = wishlist.visibility === "LINK";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-neutral-950">{wishlist.title}</h2>
            <p className="mt-1 text-sm text-neutral-600">
              {[wishlist.recipientLabel ? `Для: ${wishlist.recipientLabel}` : null, dateLabel].filter(Boolean).join(" · ") ||
                "Без даты"}
            </p>
            {archived ? <p className="mt-1 text-sm font-medium text-amber-700">В архиве</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={busy} onClick={() => void thankGuests()}>
            Сказать «Спасибо»
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => void copyForNextYear()}>
            Копия на следующий год
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() => void run(() => call(`/api/wishlists/${wishlist.id}/archive`, "POST", { archived: !archived }))}
          >
            {archived ? "Вернуть из архива" : "В архив"}
          </button>
          </div>
        </div>

        <div className="mt-5 space-y-4 border-t border-neutral-100 pt-4">
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span className="text-sm text-neutral-900">
              Доступ по ссылке
              <span className="block text-xs text-neutral-500">
                {shared ? "Гости открывают список без регистрации" : "Список виден только вам и семье"}
              </span>
            </span>
            <Switch
              checked={shared}
              disabled={busy || archived}
              onCheckedChange={(v) => void patchWishlist({ visibility: v ? "LINK" : "PRIVATE" })}
              aria-label="Доступ по ссылке"
            />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span className="text-sm text-neutral-900">
              Режим сюрприза
              <span className="block text-xs text-neutral-500">Вы не увидите, кто и что забронировал</span>
            </span>
            <Switch
              checked={wishlist.hideReservationsFromOwner}
              disabled={busy || archived}
              onCheckedChange={(v) => void patchWishlist({ hideReservationsFromOwner: v })}
              aria-label="Режим сюрприза"
            />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span className="text-sm text-neutral-900">
              Показывать гостям, кто забронировал
              <span className="block text-xs text-neutral-500">По умолчанию гости видят только «Занято»</span>
            </span>
            <Switch
              checked={wishlist.showReserverNamesToGuests}
              disabled={busy || archived}
              onCheckedChange={(v) => void patchWishlist({ showReserverNamesToGuests: v })}
              aria-label="Показывать имена гостям"
            />
          </label>
        </div>

        {shared ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
            <button type="button" className={btnPrimary} onClick={() => void copyLink()}>
              Скопировать ссылку
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => void rotateLink()}>
              Выпустить новую ссылку
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-neutral-950">Подарки</h3>

        {!archived ? (
          <form onSubmit={addItem} className="mt-3 grid gap-2 sm:grid-cols-[1fr_7rem_5rem_auto]">
            <input
              className={field}
              value={quickLine}
              onChange={(e) => setQuickLine(e.target.value)}
              placeholder="Название и ссылка, например: Лего Сити https://…"
              maxLength={2300}
              aria-label="Название подарка и ссылка"
            />
            <input
              className={field}
              value={quickPrice}
              onChange={(e) => setQuickPrice(e.target.value)}
              placeholder="Цена, BYN"
              inputMode="decimal"
              aria-label="Примерная цена"
            />
            <input
              className={field}
              value={quickQty}
              onChange={(e) => setQuickQty(e.target.value)}
              inputMode="numeric"
              aria-label="Количество"
            />
            <button type="submit" className={btnPrimary} disabled={busy || !parseQuickLine(quickLine).title}>
              Добавить
            </button>
          </form>
        ) : null}

        {wishlist.items.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-500">Пока пусто. Добавьте первый подарок строкой выше.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
            <SortableContext items={wishlist.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="mt-4 space-y-2">
                {wishlist.items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    hideReservations={wishlist.hideReservationsFromOwner}
                    disabled={busy || archived}
                    editing={editingId === item.id}
                    onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
                    onSave={(patch) => void patchItem(item.id, patch)}
                    onRemove={() => void removeItem(item.id)}
                    onReleaseReservation={(reservationId) => void releaseReservation(reservationId)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {conflict ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-neutral-950">Этот подарок уже забронирован</h4>
            <p className="mt-2 text-sm text-neutral-700">
              {conflict.reservers.length > 0
                ? `Забронировал(а): ${conflict.reservers.map((r) => r.displayName).join(", ")}. `
                : `Броней: ${conflict.reservedCount}. `}
              {conflict.reservers.some((r) => !r.hasContact)
                ? "Часть гостей не оставила контакт, мы не сможем их предупредить, сообщите им сами. "
                : "Мы предупредим гостей, оставивших контакт. "}
              Бронь будет снята.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setConflict(null)}>
                Отмена
              </button>
              <button type="button" className={btnPrimary} onClick={() => void confirmConflict()}>
                {conflict.action === "remove" ? "Удалить" : "Изменить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortableItem(props: {
  item: WishlistItemView;
  hideReservations: boolean;
  disabled: boolean;
  editing: boolean;
  onEdit: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  onReleaseReservation: (reservationId: string) => void;
}) {
  const { item, disabled, editing } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled });
  const state = itemStateLabel(item.state, item.takenQuantity, item.quantity);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-neutral-200 bg-white p-3 ${isDragging ? "opacity-70 shadow-lg" : ""}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-0.5 inline-flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:cursor-default"
          aria-label="Перетащить"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        {item.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageSrc} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-950">{item.title}</span>
            {item.quantity > 1 ? <span className="text-xs text-neutral-500">× {item.quantity}</span> : null}
            {item.priceApprox !== null ? (
              <span className="text-sm text-neutral-600">
                {item.priceApprox} {item.currency}
              </span>
            ) : null}
            {state ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">{state}</span>
            ) : null}
          </div>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-0.5 block truncate text-sm text-primary hover:underline"
            >
              {item.url}
            </a>
          ) : null}
          {item.comment ? <p className="mt-0.5 text-sm text-neutral-600">{item.comment}</p> : null}
          {!props.hideReservations && item.reservations.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-sm text-neutral-700">
              {item.reservations.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {r.displayName}
                    {r.quantity > 1 ? ` (${r.quantity})` : ""}
                    {r.status === "PURCHASED" ? " — купил(а)" : ""}
                  </span>
                  {!disabled ? (
                    <button
                      type="button"
                      className="min-h-11 text-xs text-neutral-500 underline hover:text-red-700"
                      onClick={() => props.onReleaseReservation(r.id)}
                    >
                      Снять бронь
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {!disabled ? (
          <div className="flex shrink-0 gap-1">
            <button type="button" className="min-h-11 rounded-lg px-2 text-sm text-neutral-700 hover:bg-neutral-50" onClick={props.onEdit}>
              {editing ? "Закрыть" : "Изменить"}
            </button>
            <button type="button" className="min-h-11 rounded-lg px-2 text-sm text-red-700 hover:bg-red-50" onClick={props.onRemove}>
              Удалить
            </button>
          </div>
        ) : null}
      </div>

      {editing ? <ItemEditForm item={item} onSave={props.onSave} /> : null}
    </li>
  );
}

/**
 * Mounted only while editing: drafts start from the item as it was when the form opened.
 * Save sends just the fields the author actually touched, so a link preview (title/photo)
 * that arrives while the form is open is never rolled back by an unrelated edit.
 */
function ItemEditForm(props: { item: WishlistItemView; onSave: (patch: Record<string, unknown>) => void }) {
  const { item } = props;
  const [base] = useState(() => ({
    title: item.title,
    url: item.url ?? "",
    image: item.imageUrl ?? "",
    comment: item.comment ?? "",
    price: item.priceApprox === null ? "" : String(item.priceApprox),
    qty: String(item.quantity),
  }));
  const [title, setTitle] = useState(base.title);
  const [url, setUrl] = useState(base.url);
  const [image, setImage] = useState(base.image);
  const [comment, setComment] = useState(base.comment);
  const [price, setPrice] = useState(base.price);
  const [qty, setQty] = useState(base.qty);

  function save() {
    const patch: Record<string, unknown> = {};
    const urlChanged = url !== base.url;
    const imageChanged = image !== base.image;
    if (title !== base.title) patch.title = title.trim() || item.title;
    if (urlChanged) patch.url = url.trim() || null;
    // A new link means a different product: drop the old photo unless the author set a new one.
    if (imageChanged) patch.imageUrl = image.trim() || null;
    else if (urlChanged) patch.imageUrl = null;
    if (comment !== base.comment) patch.comment = comment.trim() || null;
    if (price !== base.price) {
      const parsed = price.trim() ? Number(price.replace(",", ".")) : null;
      patch.priceApprox = parsed !== null && Number.isFinite(parsed) ? parsed : null;
    }
    if (qty !== base.qty) patch.quantity = Math.min(99, Math.max(1, Number.parseInt(qty, 10) || 1));
    if (Object.keys(patch).length === 0) return;
    props.onSave(patch);
  }

  return (
        <div className="mt-3 grid gap-2 border-t border-neutral-100 pt-3 sm:grid-cols-2">
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" maxLength={200} aria-label="Название" />
          <input className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ссылка" maxLength={2048} aria-label="Ссылка" />
          <input className={field} value={image} onChange={(e) => setImage(e.target.value)} placeholder="Ссылка на фото (если превью не подтянулось)" maxLength={2048} aria-label="Ссылка на фото" />
          <input className={field} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (размер, цвет…)" maxLength={1000} aria-label="Комментарий" />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Цена" inputMode="decimal" aria-label="Цена" />
            <input className={field} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Кол-во" inputMode="numeric" aria-label="Количество" />
          </div>
          <div className="sm:col-span-2">
            <button type="button" className={btnPrimary} onClick={save}>
              Сохранить
            </button>
          </div>
        </div>
  );
}
