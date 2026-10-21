"use client";

import { useEffect, useState } from "react";
import { BookingStatus } from "@prisma/client";
import type { BusinessBookingItem } from "@/server/services/booking/bookingQuery.service";
import { BookingDetailsDrawer } from "@/app/business/(protected)/bookings/BookingsPageClient";
import { toast } from "@/lib/toast";

interface Props {
  id: string | null;
  onClose: () => void;
  onDone: () => void;
}

/** Load one STANDARD request independently of the calendar's 200-row limit. */
export function StandardBookingDetails({ id, onClose, onDone }: Props) {
  const [item, setItem] = useState<BusinessBookingItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      setItem(null);
      try {
        const result = await fetch(
          "/api/business/bookings/" + encodeURIComponent(id),
          { signal: controller.signal, cache: "no-store" },
        );
        if (!result.ok) throw new Error("Не удалось загрузить заявку");
        const body = (await result.json()) as BusinessBookingItem;
        if (!controller.signal.aborted) setItem(body);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [id]);

  const handleStatusChange = async (bookingId: string, status: BookingStatus) => {
    const result = await fetch("/api/business/bookings/" + encodeURIComponent(bookingId) + "/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!result.ok) {
      const body = (await result.json().catch(() => ({}))) as { error?: string };
      const reason = body.error ?? "Не удалось изменить статус";
      toast.error(reason);
      return;
    }
    const updated = (await result.json()) as BusinessBookingItem;
    setItem(updated);
    toast.success("Статус обновлён");
    onDone();
  };

  const selected = id && item?.id === id ? item : null;
  return (
    <>
      {id && (loading || error) ? (
        <div className="rounded-xl border bg-white p-4" role="status">
          {error ?? "Загружаем заявку…"}
          {error ? <button type="button" className="ml-2 underline" onClick={onClose}>Закрыть</button> : null}
        </div>
      ) : null}
      <BookingDetailsDrawer
        open={Boolean(id && selected)}
        booking={selected}
        selectedIndex={0}
        total={1}
        onOpenChange={(open) => { if (!open) onClose(); }}
        onSelectPrev={() => {}}
        onSelectNext={() => {}}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}
