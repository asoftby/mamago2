"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDailyFreeBoostAction,
  getFreeBoostDialogStateAction,
} from "@/app/business/(protected)/dashboard/actions";
import type { FreeBoostCandidate } from "@/server/services/promotion/dailyFreeBoost.service";

type DialogData = {
  availableToday: boolean;
  nextFreeAt: string | null;
  candidates: FreeBoostCandidate[];
};

type BoostTarget = {
  id: string;
  publicationType: "EVENT" | "OFFER";
  title: string;
};

export function BoostLauncher({
  target,
  children,
  className,
  disabled = false,
}: {
  target?: BoostTarget;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DialogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function showDialog() {
    if (disabled) return;
    setOpen(true);
    setLoading(true);
    setData(null);
    setError(null);
    setSelectedKey(null);
    // Fresh server-side eligibility and quota check on every opening.
    void getFreeBoostDialogStateAction()
      .then((result) => {
        if (result.ok) setData(result.data);
        else setError(result.error);
      })
      .catch(() => setError("Не удалось получить список публикаций. Попробуйте снова."))
      .finally(() => setLoading(false));
  }

  const key = target
    ? `${target.publicationType}:${target.id}`
    : selectedKey;
  const candidate = data?.candidates.find(
    (item) => `${item.publicationType}:${item.id}` === key,
  );
  const nextFreeLabel = data?.nextFreeAt
    ? new Intl.DateTimeFormat("ru-BY", {
        timeZone: "Europe/Minsk",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(data.nextFreeAt))
    : null;
  const canConfirm = Boolean(
    candidate?.eligible &&
      !candidate.activeBoostUntil &&
      data?.availableToday &&
      !pending,
  );

  function confirm() {
    if (!canConfirm || !candidate) return;
    startTransition(async () => {
      try {
        const result = await createDailyFreeBoostAction({
          publicationId: candidate.id,
          publicationType: candidate.publicationType,
        });
        if (!result.ok) {
          toast.error(result.error);
          // The quota or target may have changed after the modal opened.
          const updated = await getFreeBoostDialogStateAction();
          if (updated.ok) setData(updated.data);
          return;
        }
        setOpen(false);
        toast.success("Публикация поднята на 24 часа");
        router.refresh();
      } catch {
        toast.error("Не удалось поднять публикацию. Попробуйте ещё раз.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={showDialog}
        disabled={disabled}
        className={cn(className, "disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none disabled:hover:bg-stone-200")}
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Продвинуть публикацию?</DialogTitle>
            <DialogDescription>
              Одно бесплатное поднятие на бизнес каждые 24 часа. Без списания денег.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-5 text-sm text-stone-500" role="status">
              Проверяем доступность продвижения…
            </p>
          ) : error ? (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>
          ) : data ? (
            <div className="space-y-4">
              {target ? (
                <div className="rounded-xl border border-stone-200 p-3">
                  <p className="text-sm font-semibold text-stone-900">{target.title}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {target.publicationType === "EVENT" ? "Событие" : "Предложение"}
                  </p>
                </div>
              ) : data.candidates.length ? (
                <div className="max-h-64 space-y-2 overflow-y-auto" aria-label="Выбор публикации">
                  {data.candidates.map((item) => {
                    const itemKey = `${item.publicationType}:${item.id}`;
                    return (
                      <button
                        type="button"
                        key={itemKey}
                        onClick={() => setSelectedKey(itemKey)}
                        disabled={!item.eligible || Boolean(item.activeBoostUntil)}
                        aria-pressed={selectedKey === itemKey}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
                          selectedKey === itemKey
                            ? "border-stone-900 bg-stone-50"
                            : "border-stone-200 hover:bg-stone-50",
                        )}
                      >
                        <span className="block font-semibold text-stone-900">{item.title}</span>
                        <span className="mt-1 block text-xs text-stone-500">
                          {item.publicationType === "EVENT" ? "Событие" : "Предложение"}
                          {" · "}
                          {item.activeBoostUntil
                            ? "Продвижение уже активно"
                            : item.eligible
                              ? "Доступно"
                              : item.reason}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-stone-600">
                  У бизнеса нет событий или предложений. Места не участвуют в Boost.
                </p>
              )}

              {target && !candidate ? (
                <p className="text-sm text-red-700">
                  Публикация не найдена в списке вашего бизнеса.
                </p>
              ) : candidate?.activeBoostUntil ? (
                <p className="text-sm text-stone-600">
                  Для этой публикации уже действует продвижение. Повторное поднятие пока недоступно.
                </p>
              ) : candidate && !candidate.eligible ? (
                <p className="text-sm text-amber-800">{candidate.reason}</p>
              ) : null}

              {!data.availableToday && (
                <p className="text-sm text-stone-600">
                  Бесплатное поднятие уже использовано.
                  {nextFreeLabel ? ` Следующее: ${nextFreeLabel} (Минск).` : ""}
                </p>
              )}

              <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
                <span className="text-stone-600">Стоимость</span>
                <strong>0 BYN</strong>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">Продолжительность</span>
                <strong>24 часа</strong>
              </div>
              <p className="text-xs leading-relaxed text-stone-500">
                Поднятие повышает приоритет в своём регионе, но не гарантирует конкретную позицию.
              </p>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={confirm}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
              >
                <Zap className="h-4 w-4" />
                {pending ? "Поднимаем…" : "Подтвердить бесплатно"}
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
