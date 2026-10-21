"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";

type ClassSlot = {
  startsAt: string;
  endsAt: string;
  remainingSeats: number | null;
};
type SlotsResponse = { slots?: ClassSlot[]; error?: string };
type BookingResponse = { bookingId?: string; status?: string; error?: string };
type PrefillResponse = {
  authenticated: boolean;
  user: { displayName: string | null; email: string | null; phone: string | null; phoneVerified: boolean } | null;
  children: Array<{ id: string; name: string | null; age: number | null }>;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Minsk", weekday: "short", day: "numeric", month: "short",
});
const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Minsk", hour: "2-digit", minute: "2-digit", hour12: false,
});

export function ClassBookingOverlay({ open, onOpenChange, offerId, offerTitle }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  offerTitle: string;
}) {
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [children, setChildren] = useState<PrefillResponse["children"]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const from = new Date();
    const to = new Date(from.getTime() + 30 * 86_400_000);
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), seats: String(seats) });
    // Defer state updates into the asynchronous request, and cancel stale responses.
    void (async () => {
      try {
        const response = await fetch(`/api/public/offers/${encodeURIComponent(offerId)}/slots?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json() as SlotsResponse;
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить расписание");
        if (controller.signal.aborted) return;
        setSlots(data.slots ?? []);
        setSelected((previous) => (data.slots ?? []).some((slot) => slot.startsAt === previous) ? previous : null);
        setError(null);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить расписание");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [open, offerId, seats, refresh]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/public/bookings/camp-shift/prefill", {
      signal: controller.signal, credentials: "include", cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as PrefillResponse;
      if (controller.signal.aborted) return;
      setChildren(data.children ?? []);
      setSelectedChildId(data.children?.length === 1 ? data.children[0].id : "");
      if (data.user?.displayName) setName((previous) => previous || data.user!.displayName || "");
      if (data.user?.email) setEmail((previous) => previous || data.user!.email || "");
      if (data.user?.phoneVerified && data.user.phone) setPhone((previous) => previous || data.user!.phone || "");
    }).catch(() => undefined);
    return () => controller.abort();
  }, [open]);

  const chosen = useMemo(() => slots.find((slot) => slot.startsAt === selected) ?? null, [slots, selected]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/offers/${encodeURIComponent(offerId)}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: chosen.startsAt, endsAt: chosen.endsAt,
          seats, customerName: name.trim(), customerPhone: phone.trim(),
          ...(email.trim() ? { customerEmail: email.trim() } : {}),
          ...(seats === 1 && selectedChildId ? { childId: selectedChildId } : {}),
        }),
      });
      const result = await response.json() as BookingResponse;
      if (!response.ok) {
        if (response.status === 409) setRefresh((n) => n + 1);
        throw new Error(result.error || "Не получилось отправить заявку");
      }
      if (!result.bookingId) throw new Error("Не удалось получить номер заявки");
      setBookingId(result.bookingId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить заявку");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => {
        if (!next) { setBookingId(null); setSelected(null); setError(null); }
        else setLoading(true);
        onOpenChange(next);
      }}
      a11yTitle="Запись на занятие"
      variant="framed"
      title="Запись на занятие"
      subtitle={offerTitle}
      heightMode="tall"
      dialogContentClassName="max-w-xl"
    >
      {bookingId ? (
        <div role="status" className="space-y-3 p-5">
          <h3 className="text-lg font-semibold">Заявка отправлена</h3>
          <p>Место временно удерживается. Дождитесь подтверждения организатора.</p>
          <p className="text-sm text-muted-foreground">Номер заявки: {bookingId}</p>
          <Button className="w-full" onClick={() => onOpenChange(false)}>Готово</Button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-5 p-5">
          <div className="space-y-2">
            <label htmlFor="class-booking-seats" className="text-sm font-medium">Количество детей / мест</label>
            <Input id="class-booking-seats" type="number" min={1} max={20} value={seats}
              onChange={(event) => { setSeats(Math.max(1, Math.min(20, Number(event.target.value) || 1))); setLoading(true); }} />
          </div>
          {seats === 1 && children.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="class-booking-child" className="text-sm font-medium">Для кого занятие</label>
              <select id="class-booking-child" className="w-full rounded-xl border bg-background p-3 text-sm"
                value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
                <option value="">Не выбирать из профиля</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.name || "Ребёнок"}{child.age !== null ? ` · ${child.age} лет` : ""}</option>
                ))}
              </select>
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Дата и время (Минск)</legend>
            {loading && <p role="status" className="text-sm text-muted-foreground">Загружаем расписание…</p>}
            {!loading && slots.length === 0 && !error && <p className="text-sm text-muted-foreground">Пока нет доступных занятий на ближайшие 30 дней.</p>}
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {slots.map((slot) => (
                <label key={slot.startsAt} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 has-[:checked]:border-primary">
                  <input type="radio" name="class-slot" value={slot.startsAt} checked={selected === slot.startsAt}
                    onChange={() => setSelected(slot.startsAt)} />
                  <span className="flex-1 text-sm">{dateFormatter.format(new Date(slot.startsAt))}, {timeFormatter.format(new Date(slot.startsAt))}</span>
                  {slot.remainingSeats !== null && <span className="text-xs text-muted-foreground">Мест: {slot.remainingSeats}</span>}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <label htmlFor="class-booking-name" className="text-sm font-medium">Ваше имя</label>
            <Input id="class-booking-name" autoComplete="name" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} />
            <label htmlFor="class-booking-phone" className="text-sm font-medium">Телефон</label>
            <Input id="class-booking-phone" type="tel" autoComplete="tel" required minLength={7} maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} />
            <label htmlFor="class-booking-email" className="text-sm font-medium">Email (необязательно)</label>
            <Input id="class-booking-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={!chosen || loading || submitting}>
            {submitting ? "Отправляем…" : "Отправить заявку"}
          </Button>
          <p className="text-xs text-muted-foreground">Заявка ещё не означает подтверждённую запись.</p>
        </form>
      )}
    </ResponsiveOverlay>
  );
}
