"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { createIdempotencyKey, type InboxItem } from "@/lib/business/bookingsInbox";
import { toast } from "@/lib/toast";
import { postInboxAction } from "./inboxApi";
import { formatInboxSchedule } from "./inboxFormat";

type Availability = {
  requestId: string;
  quoteVersion: number;
  units: Array<{ id: string; name: string }>;
};

interface Props {
  item: InboxItem | null;
  onClose: () => void;
  onDone: () => void;
}

export function PartyConfirmOverlay({ item, onClose, onDone }: Props) {
  return (
    <ResponsiveOverlay
      open={Boolean(item)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      a11yTitle="Подтверждение площадки"
      title="Подтвердить площадку"
      subtitle={item ? `${item.title ?? "Праздник"} · ${formatInboxSchedule(item)}` : undefined}
    >
      {item ? <PartyConfirmForm key={item.id + ":" + (item.quote?.version ?? "")} item={item} onClose={onClose} onDone={onDone} /> : null}
    </ResponsiveOverlay>
  );
}

function PartyConfirmForm({ item, onClose, onDone }: { item: InboxItem; onClose: () => void; onDone: () => void }) {
  const [available, setAvailable] = useState<Availability | null>(null);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef(createIdempotencyKey("party-confirm"));

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/business/party-requests/${encodeURIComponent(item.id)}/units`,
          { cache: "no-store", signal: controller.signal },
        );
        const json = (await res.json().catch(() => ({}))) as Availability & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Не удалось проверить свободные площадки");
        if (controller.signal.aborted) return;
        setAvailable(json);
        setSelectedUnit(json.units.length === 1 ? json.units[0]!.id : "");
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [item.id]);

  const submit = async () => {
    if (!available || !selectedUnit || saving || item.partyStage !== "AWAITING_RECONFIRM" ||
        available.quoteVersion !== item.quote?.version) {
      setError("Предложение изменилось. Обновите список заявок.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await postInboxAction(
        `/api/business/party-requests/${encodeURIComponent(item.id)}/confirm`,
        { expectedQuoteVersion: available.quoteVersion, bookingUnitId: selectedUnit },
        "party-confirm", keyRef.current,
      );
      toast.success("Площадка подтверждена");
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подтвердить площадку");
      // Do not retry with a different resource/key automatically.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        <p className="text-sm text-muted-foreground">
          Семья приняла условия. Подтверждение займёт конкретный ресурс на выбранное время.
          Перед записью система повторно проверит его доступность.
        </p>
        {loading ? <p role="status" className="text-sm">Проверяем свободные площадки…</p> : null}
        {!loading && available?.units.length === 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Нет свободного ресурса с настроенным расписанием для этого времени.
            Бронирование не подтверждено. Уточните расписание или предложите семье другие условия.
          </p>
        ) : null}
        {!loading && available && available.units.length > 0 ? (
          <label className="block space-y-2 text-sm font-medium" htmlFor="party-confirm-booking-unit">
            <span>Свободная площадка или зал</span>
            <select
              id="party-confirm-booking-unit"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
              value={selectedUnit}
              onChange={(event) => setSelectedUnit(event.target.value)}
            >
              <option value="">Выберите ресурс</option>
              {available.units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      </div>
      <div className="flex gap-2 border-t border-border px-4 py-3 sm:px-5">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        <Button type="button" className="flex-1" onClick={() => void submit()}
          disabled={saving || loading || !selectedUnit || !available || available.quoteVersion !== item.quote?.version}>
          {saving ? "Подтверждаем…" : "Подтвердить бронирование"}
        </Button>
      </div>
    </div>
  );
}
