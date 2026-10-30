"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@/lib/toast";
import { wishlistErrorMessage } from "../lib/wishlistView";

type ListOption = { id: string; title: string };

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-900 hover:border-neutral-900 disabled:opacity-60";

/**
 * "В список желаний" on a catalog offer. Guests are sent to login and come back
 * to this page; no action is resumed (intent is a separate planned feature).
 */
export function AddOfferToWishlist({ offerId, title }: { offerId: string; title: string }) {
  const router = useRouter();
  const [lists, setLists] = useState<ListOption[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function openPicker() {
    setBusy(true);
    try {
      const res = await fetch("/api/wishlists", { credentials: "include" });
      if (res.status === 401) {
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        wishlists?: Array<{ id: string; title: string; status: string }>;
        error?: string;
      };
      if (!res.ok) {
        toast.error(wishlistErrorMessage(data.error));
        return;
      }
      const active = (data.wishlists ?? []).filter((w) => w.status === "ACTIVE");
      if (active.length === 0) {
        router.push("/me/wishlists");
        return;
      }
      setLists(active.map((w) => ({ id: w.id, title: w.title })));
    } catch {
      toast.error(wishlistErrorMessage(null));
    } finally {
      setBusy(false);
    }
  }

  async function add(listId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/wishlists/${listId}/items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, offerId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        toast.success("Добавлено в список желаний");
        setLists(null);
      } else {
        toast.error(wishlistErrorMessage(data.error));
      }
    } catch {
      toast.error(wishlistErrorMessage(null));
    } finally {
      setBusy(false);
    }
  }

  if (lists) {
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Выберите список желаний">
        {lists.map((l) => (
          <button key={l.id} type="button" className={btn} disabled={busy} onClick={() => void add(l.id)}>
            {l.title}
          </button>
        ))}
        <button type="button" className="min-h-11 px-2 text-sm text-neutral-600" onClick={() => setLists(null)}>
          Отмена
        </button>
      </div>
    );
  }
  return (
    <button type="button" className={btn} disabled={busy} onClick={() => void openPicker()}>
      В список желаний
    </button>
  );
}
