"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BusinessUnpVerificationStatus } from "@prisma/client";

const BADGE_CLASS_BY_STATUS: Record<BusinessUnpVerificationStatus, string> = {
  VERIFIED: "border-green-200 bg-green-100 text-green-800",
  PENDING: "border-yellow-200 bg-yellow-100 text-yellow-800",
  NAME_MISMATCH: "border-yellow-200 bg-yellow-100 text-yellow-800",
  LOOKUP_FAILED: "border-yellow-200 bg-yellow-100 text-yellow-800",
  INACTIVE: "border-red-200 bg-red-100 text-red-800",
  NOT_FOUND: "border-red-200 bg-red-100 text-red-800",
};

const LABEL_BY_STATUS: Record<BusinessUnpVerificationStatus, string> = {
  VERIFIED: "Подтверждён",
  PENDING: "Проверка не выполнялась",
  NAME_MISMATCH: "Название не совпадает",
  LOOKUP_FAILED: "Реестр недоступен",
  INACTIVE: "Не действующий в ГРП",
  NOT_FOUND: "Не найден в ГРП",
};

interface UnpVerificationState {
  unpVerificationStatus: BusinessUnpVerificationStatus;
  unpVerifiedAt: string | null;
  unpOfficialName: string | null;
  unpLastCheckedAt: string | null;
}

/**
 * Статус автоматической сверки УНП с ГРП + ручной триггер перепроверки.
 * Не блокирует и не меняет verificationStatus/operationalStatus — это
 * отдельный, доп. сигнал для модератора (см. открытый вопрос в финальном
 * отчёте: связь с депозитной моделью намеренно не реализована).
 */
export function UnpVerificationSection({
  businessId,
  unp,
  legalName,
  initialState,
  canRecheck,
}: {
  businessId: string;
  unp: string | null;
  legalName: string | null;
  initialState: UnpVerificationState;
  /** Модераторы тоже могут перепроверять — это read-only внешний lookup, не изменение верификации/биллинга. */
  canRecheck: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);

  const recheck = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/business/${businessId}/unp-recheck`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Не удалось перепроверить УНП");
      }
      setState({
        unpVerificationStatus: data.unpVerificationStatus,
        unpVerifiedAt: data.unpVerifiedAt,
        unpOfficialName: data.unpOfficialName,
        unpLastCheckedAt: data.unpLastCheckedAt,
      });
      router.refresh();
      toast.success("Сверка с ГРП выполнена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось перепроверить УНП");
    } finally {
      setLoading(false);
    }
  };

  const officialNameDiffers =
    state.unpOfficialName &&
    state.unpOfficialName.trim() &&
    state.unpOfficialName.trim() !== (legalName ?? "").trim();

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Сверка УНП с ГРП</div>
        <div className="text-base">
          <Badge className={cn("border px-2.5 py-0.5 text-xs font-medium", BADGE_CLASS_BY_STATUS[state.unpVerificationStatus])}>
            {LABEL_BY_STATUS[state.unpVerificationStatus] || state.unpVerificationStatus}
          </Badge>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Последняя проверка</div>
        <div className="text-base">
          {state.unpLastCheckedAt
            ? new Date(state.unpLastCheckedAt).toLocaleString("ru-RU")
            : "—"}
        </div>
      </div>

      {officialNameDiffers && (
        <div className="col-span-2">
          <div className="text-sm font-medium text-gray-500 mb-1">
            Официальное название по данным ГРП
          </div>
          <div className="text-base bg-gray-50 p-3 rounded">{state.unpOfficialName}</div>
        </div>
      )}

      {canRecheck && (
        <div className="col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !unp}
            onClick={() => void recheck()}
          >
            {loading ? "Проверяем…" : "Перепроверить сейчас"}
          </Button>
          {!unp && (
            <p className="mt-2 text-xs text-muted-foreground">
              У бизнеса не указан УНП — проверка недоступна.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
