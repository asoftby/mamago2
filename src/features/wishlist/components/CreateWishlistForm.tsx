"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/lib/toast";
import { wishlistErrorMessage } from "@/features/wishlist/lib/wishlistView";

const field =
  "min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 md:text-sm";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50";

export type RecipientChild = { id: string; name: string | null };

export function CreateWishlistForm({
  childrenList,
  defaultChildId,
  defaultTitle = "",
  defaultDate = "",
}: {
  childrenList: RecipientChild[];
  defaultChildId?: string | null;
  defaultTitle?: string;
  defaultDate?: string;
}) {
  const router = useRouter();
  const [childId, setChildId] = useState(defaultChildId ?? childrenList[0]?.id ?? "");
  const [adultName, setAdultName] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [eventDate, setEventDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);

  const forChild = childId !== "";
  const selectedChild = childrenList.find((c) => c.id === childId);
  const suggestedTitle = `Подарки на день рождения${
    forChild ? (selectedChild?.name ? `: ${selectedChild.name}` : "") : adultName.trim() ? `: ${adultName.trim()}` : ""
  }`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/wishlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || suggestedTitle,
          occasion: "BIRTHDAY",
          recipientChildId: forChild ? childId : null,
          recipientName: forChild ? null : adultName.trim() || null,
          eventDate: eventDate || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { wishlist?: { id: string }; error?: string };
      if (res.ok && data.wishlist) router.push(`/me/wishlists/${data.wishlist.id}`);
      else toast.error(wishlistErrorMessage(data.error));
    } catch {
      toast.error(wishlistErrorMessage(null));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-neutral-950">Новый вишлист</h2>
      <label className="block text-sm text-neutral-700">
        Для кого
        <select className={`${field} mt-1`} value={childId} onChange={(e) => setChildId(e.target.value)}>
          {childrenList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name?.trim() || "Ребёнок"}
            </option>
          ))}
          <option value="">Взрослый или другой получатель</option>
        </select>
      </label>
      {!forChild ? (
        <input
          className={field}
          value={adultName}
          onChange={(e) => setAdultName(e.target.value)}
          placeholder="Имя получателя (необязательно)"
          maxLength={60}
          aria-label="Имя получателя"
        />
      ) : null}
      <label className="block text-sm text-neutral-700">
        Название
        <input
          className={`${field} mt-1`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={suggestedTitle}
          maxLength={120}
        />
      </label>
      <label className="block text-sm text-neutral-700">
        Дата праздника
        <input className={`${field} mt-1`} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      </label>
      <button type="submit" className={btnPrimary} disabled={busy}>
        Создать
      </button>
    </form>
  );
}
