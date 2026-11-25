"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Offer = {
  id: string;
  status: "OFFERED" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELED";
  expiresAt: string;
  publicationTitle: string;
  requestedDate: string | null;
  requestedTime: string | null;
  canAccept: boolean;
  newBookingId: string | null;
};

export function BookingReofferClient({ id }: { id: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/booking-reoffers/${encodeURIComponent(id)}`, {
      cache: "no-store", credentials: "include", signal: controller.signal,
    }).then(async (result) => {
      if (result.status === 401 || result.status === 404) throw new Error("Войдите в аккаунт, которому адресовано предложение.");
      if (!result.ok) throw new Error("Не удалось загрузить предложение.");
      return result.json() as Promise<Offer>;
    }).then((value) => {
      if (!controller.signal.aborted) setOffer(value);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [id]);

  async function decide(action: "ACCEPT" | "DECLINE") {
    if (acting) return;
    setActing(true);
    setError(null);
    try {
      const response = await fetch(`/api/booking-reoffers/${encodeURIComponent(id)}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { error?: string; bookingId?: string; status?: Offer["status"] };
      if (!response.ok) throw new Error(payload.error ?? "Не удалось сохранить решение");
      setOffer((current) => current ? {
        ...current, status: payload.status ?? current.status,
        canAccept: false, newBookingId: payload.bookingId ?? current.newBookingId,
      } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка соединения");
    } finally {
      setActing(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-12">
      <h1 className="text-2xl font-bold">Освободилось место</h1>
      {loading ? <p className="mt-4 text-stone-600">Загружаем предложение…</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p> : null}
      {offer ? (
        <section className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-xl font-semibold">{offer.publicationTitle}</h2>
          {offer.requestedDate ? (
            <p className="text-stone-600">
              {new Date(offer.requestedDate).toLocaleDateString("ru-BY")}
              {offer.requestedTime ? ` · ${offer.requestedTime}` : ""}
            </p>
          ) : null}
          {offer.status === "OFFERED" && offer.canAccept ? (
            <>
              <p className="text-stone-700">
                Организатор предлагает вам записаться повторно. Место не зарезервировано:
                перед созданием новой заявки система ещё раз проверит наличие мест.
              </p>
              <p className="text-sm text-stone-500">
                Ответьте до {new Date(offer.expiresAt).toLocaleString("ru-BY")}.
              </p>
              <button type="button" disabled={acting} onClick={() => void decide("ACCEPT")}
                className="w-full rounded-xl bg-stone-950 px-5 py-3 font-semibold text-white disabled:opacity-50">
                {acting ? "Проверяем места…" : "Да, записаться"}
              </button>
              <button type="button" disabled={acting} onClick={() => void decide("DECLINE")}
                className="w-full rounded-xl border border-stone-300 px-5 py-3 font-semibold disabled:opacity-50">
                Не подходит
              </button>
            </>
          ) : offer.status === "ACCEPTED" ? (
            <p className="text-emerald-800">Новая заявка создана и ожидает ответа организатора.</p>
          ) : (
            <p className="text-stone-700">Предложение больше не действует ({offer.status}).</p>
          )}
          <Link href="/me/bookings" className="inline-block text-sm font-semibold underline">
            Мои записи
          </Link>
        </section>
      ) : null}
    </main>
  );
}
