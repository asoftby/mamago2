"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BusinessOperationalStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import type { BusinessVisibilityStatus } from "@/lib/business/businessStatusModel";

export function BusinessVisibilityControl({
  businessId,
  initialVisibilityStatus,
  onStatusChange,
  readOnly = false,
}: {
  businessId: string;
  /** Видимость для пользователей сайта — `Business.operationalStatus` в БД. */
  initialVisibilityStatus: BusinessVisibilityStatus;
  onStatusChange?: (status: BusinessOperationalStatus) => void;
  /** Только чтение (например, модератор без права менять operationalStatus). */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<BusinessOperationalStatus>(
    initialVisibilityStatus,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStatus(initialVisibilityStatus);
  }, [initialVisibilityStatus]);

  const patchStatus = async (next: BusinessOperationalStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/business/${businessId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Ошибка сохранения",
        );
      }
      setStatus(next);
      onStatusChange?.(next);
      router.refresh();
      if (next === "DISABLED") {
        toast.success("Бизнес отключён. Контент скрыт от пользователей.");
      } else if (next === "ARCHIVED") {
        toast.success("Бизнес переведён в архив.");
      } else {
        toast.success("Бизнес снова активен.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const isActive = status === "ACTIVE";
  const isArchived = status === "ARCHIVED";

  const badgeClass = isActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-50"
    : isArchived
      ? "border-neutral-300 bg-neutral-100 text-neutral-900 hover:bg-neutral-100"
      : "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-50";

  const badgeLabel = isActive ? "Активен" : isArchived ? "Архивирован" : "Отключен";

  const description = isActive
    ? "Бизнес отображается пользователям и участвует в выдаче."
    : isArchived
      ? "Бизнес выведен из активной работы и не участвует в выдаче."
      : "Бизнес скрыт от пользователей и не участвует в выдаче.";

  return (
    <>
      <section
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        aria-labelledby="business-visibility-title"
      >
        <h3
          id="business-visibility-title"
          className="text-base font-semibold text-gray-900"
        >
          Управление видимостью бизнеса
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Статус (видимость):</span>
          <Badge
            className={cn(
              "border px-2.5 py-0.5 text-sm font-medium",
              badgeClass,
            )}
          >
            {badgeLabel}
          </Badge>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-gray-600">{description}</p>

        {readOnly && (
          <p className="mt-3 text-xs text-muted-foreground">
            Изменить видимость может только администратор.
          </p>
        )}

        {!readOnly && (
          <div className="mt-5 flex flex-wrap gap-2">
            {isActive ? (
              <Button
                type="button"
                variant="outline"
                className="border-amber-400 bg-white text-amber-950 hover:bg-amber-50"
                disabled={loading}
                onClick={() => setConfirmOpen(true)}
              >
                Отключить бизнес
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                className="bg-emerald-700 text-white hover:bg-emerald-800"
                disabled={loading}
                onClick={() => void patchStatus("ACTIVE")}
              >
                Включить бизнес
              </Button>
            )}
            {isActive && (
              <Button
                type="button"
                variant="ghost"
                className="text-neutral-600"
                disabled={loading}
                onClick={() => {
                  if (
                    !confirm(
                      "Перевести бизнес в архив? Публичный контент будет скрыт; владелец не сможет пользоваться кабинетом до восстановления.",
                    )
                  ) {
                    return;
                  }
                  void patchStatus("ARCHIVED");
                }}
              >
                В архив
              </Button>
            )}
          </div>
        )}
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить бизнес?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Вы уверены, что хотите отключить бизнес? Он перестанет отображаться
              пользователям; опубликованный контент скроется из выдачи без удаления
              данных.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-700 text-white hover:bg-amber-800"
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                void patchStatus("DISABLED");
              }}
            >
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
