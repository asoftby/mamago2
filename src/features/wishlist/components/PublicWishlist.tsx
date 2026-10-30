"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PublicItemView, PublicWishlistView } from "@/server/wishlist/wishlistPublic.service";
import { formatEventDate, wishlistErrorMessage } from "../lib/wishlistView";

const NAME_KEY = "wl_guest_name";
const field = "min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm";
const btnPrimary = "min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-60";
const btnGhost = "min-h-11 rounded-lg px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60";

function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage unavailable: the name is simply not remembered */
  }
}

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error };
  } catch {
    return { ok: false };
  }
}

export function PublicWishlist({
  token,
  wishlist,
}: {
  token: string;
  wishlist: PublicWishlistView;
}) {
  const router = useRouter();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>, okMessage?: string) {
    setBusy(true);
    setMessage(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setMessage(wishlistErrorMessage(res.error));
    else {
      setOpenItem(null);
      if (okMessage) setMessage(okMessage);
    }
    // sold_out and friends: refresh so the visitor sees the real state.
    router.refresh();
    return res.ok;
  }

  const date = formatEventDate(wishlist.eventDate);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-950">{wishlist.title}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {[wishlist.recipientLabel, date].filter(Boolean).join(" · ")}
      </p>
      {wishlist.note ? <p className="mt-3 whitespace-pre-line text-neutral-800">{wishlist.note}</p> : null}
      {wishlist.archived ? (
        <p className="mt-3 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-700">Список закрыт, бронировать больше нельзя.</p>
      ) : (
        <p className="mt-3 text-sm text-neutral-600">
          Выберите подарок и отметьте, что берёте его. Регистрация не нужна, достаточно имени.
        </p>
      )}
      {message ? (
        <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {message}
        </p>
      ) : null}

      {wishlist.items.length === 0 ? <p className="mt-6 text-neutral-600">Пока в списке ничего нет.</p> : null}
      <ul className="mt-6 space-y-3">
        {wishlist.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            archived={wishlist.archived}
            busy={busy}
            open={openItem === item.id}
            onToggle={() => setOpenItem(openItem === item.id ? null : item.id)}
            onReserve={(body) =>
              act(async () => {
                const r = await send(`/api/w/${token}/items/${item.id}/reserve`, "POST", body);
                if (r.ok) saveName(body.displayName);
                return r;
              }, "Готово, подарок за вами. Эта страница запомнит вашу бронь в этом браузере.")
            }
            onAction={(reservationId, action) =>
              act(() => send(`/api/w/${token}/reservations/${reservationId}`, "PATCH", { action }))
            }
          />
        ))}
      </ul>
    </div>
  );
}

function ItemCard(props: {
  item: PublicItemView;
  archived: boolean;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onReserve: (body: { displayName: string; quantity: number; contactEmail: string | null; consent: boolean }) => Promise<boolean>;
  onAction: (reservationId: string, action: "cancel" | "purchased") => Promise<boolean>;
}) {
  const { item } = props;
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  const stateLabel =
    item.state === "TAKEN" ? "Занято" : item.state === "PARTIAL" ? `Свободно ${item.availableQuantity} из ${item.quantity}` : null;

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex gap-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
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
            {stateLabel ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">{stateLabel}</span> : null}
          </div>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-0.5 block truncate text-sm text-primary hover:underline">
              {item.url}
            </a>
          ) : null}
          {item.comment ? <p className="mt-0.5 text-sm text-neutral-600">{item.comment}</p> : null}
          {item.reserverNames && item.reserverNames.length > 0 ? (
            <p className="mt-1 text-sm text-neutral-600">Берут: {item.reserverNames.join(", ")}</p>
          ) : null}
        </div>
      </div>

      {item.mine.map((r) => (
        <div key={r.id} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <span>{r.status === "PURCHASED" ? "Вы купили" : "Вы берёте"}{r.quantity > 1 ? ` (${r.quantity} шт.)` : ""}</span>
          {!props.archived ? (
            <span className="ml-auto flex gap-1">
              {r.status === "RESERVED" ? (
                <button type="button" className={btnGhost} disabled={props.busy} onClick={() => void props.onAction(r.id, "purchased")}>
                  Куплено
                </button>
              ) : null}
              <button type="button" className={btnGhost} disabled={props.busy} onClick={() => void props.onAction(r.id, "cancel")}>
                Отменить
              </button>
            </span>
          ) : null}
        </div>
      ))}

      {!props.archived && item.availableQuantity > 0 ? (
        props.open ? (
          <form
            className="mt-3 grid gap-2 border-t border-neutral-100 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const quantity = Math.min(item.availableQuantity, Math.max(1, Number.parseInt(qty, 10) || 1));
              void props.onReserve({
                displayName: name.trim(),
                quantity,
                contactEmail: email.trim() || null,
                consent: email.trim() ? consent : false,
              });
            }}
          >
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" maxLength={60} required aria-label="Ваше имя" />
            {item.availableQuantity > 1 ? (
              <input className={field} value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder={`Сколько штук (до ${item.availableQuantity})`} aria-label="Количество" />
            ) : null}
            <input className={field} value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email для уведомлений (необязательно)" maxLength={254} aria-label="Email" />
            {email.trim() ? (
              <label className="flex items-start gap-2 text-xs text-neutral-600">
                <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                Согласен(на), что напишете мне, если автор изменит или уберёт этот подарок.
              </label>
            ) : null}
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={props.busy || !name.trim() || (Boolean(email.trim()) && !consent)}>
                Беру этот подарок
              </button>
              <button type="button" className={btnGhost} onClick={props.onToggle}>
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className={`${btnPrimary} mt-3`}
            onClick={() => {
              if (!name) setName(readName());
              props.onToggle();
            }}
          >
            Я подарю это
          </button>
        )
      ) : null}
    </li>
  );
}
