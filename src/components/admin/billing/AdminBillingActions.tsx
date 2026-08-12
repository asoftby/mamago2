"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface AdminBillingActionsProps {
  businessId: string;
  accountStatus: string;
  currentBalance: number;
  currency: string;
}

export function AdminBillingActions({
  businessId,
  accountStatus,
  currentBalance,
  currency,
}: AdminBillingActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [formData, setFormData] = useState({
    amount: "",
    reason: "",
    note: "",
    allowNegative: false,
  });

  const handleAction = async (action: string) => {
    setIsLoading(true);
    try {
      let endpoint = "";
      let body: Record<string, unknown> = { businessId };

      switch (action) {
        case "credit":
          endpoint = "/api/admin/billing/credit";
          body = {
            ...body,
            amount: parseFloat(formData.amount),
            currency: "BYN",
            idempotencyKey,
            reason: formData.reason,
            note: formData.note,
          };
          break;
        case "debit":
          endpoint = "/api/admin/billing/debit";
          body = {
            ...body,
            amount: parseFloat(formData.amount),
            currency: "BYN",
            idempotencyKey,
            reason: formData.reason,
            note: formData.note,
            allowNegative: formData.allowNegative,
          };
          break;
        case "suspend":
          endpoint = "/api/admin/billing/suspend";
          body = {
            ...body,
            reason: formData.reason,
          };
          break;
        case "reactivate":
          endpoint = "/api/admin/billing/reactivate";
          break;
        case "recalculate":
          endpoint = "/api/admin/billing/recalculate";
          break;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Ошибка: ${data.error}`);
        return;
      }

      alert("Операция выполнена успешно");
      setActiveModal(null);
      setIdempotencyKey(crypto.randomUUID());
      setFormData({ amount: "", reason: "", note: "", allowNegative: false });
      router.refresh();
    } catch (error) {
      console.error("Action error:", error);
      alert("Произошла ошибка при выполнении операции");
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (modal: string) => {
    setActiveModal(modal);
    setFormData({ amount: "", reason: "", note: "", allowNegative: false });
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ручные операции</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => openModal("credit")}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            <span>💰</span>
            Начислить депозит
          </button>
          <button
            onClick={() => openModal("debit")}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            <span>💸</span>
            Списать вручную
          </button>
          <button
            onClick={() => openModal("recalculate")}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            <span>📊</span>
            Пересчитать баланс
          </button>
          {accountStatus === "ACTIVE" ? (
            <button
              onClick={() => openModal("suspend")}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium text-red-700"
            >
              <span>⏸️</span>
              Приостановить аккаунт
            </button>
          ) : (
            <button
              onClick={() => openModal("reactivate")}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-green-300 rounded-lg hover:bg-green-50 text-sm font-medium text-green-700"
            >
              <span>▶️</span>
              Восстановить аккаунт
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Все операции создают записи в ledger и сохраняют audit trail
        </p>
      </div>

      {/* Credit Modal */}
      {activeModal === "credit" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Начислить депозит
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сумма ({currency})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Причина *
                </label>
                <Input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Промо-акция, компенсация и т.д."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Примечание
                </label>
                <Textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={2}
                  placeholder="Дополнительная информация"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                onClick={() => handleAction("credit")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                disabled={isLoading || !formData.amount || !formData.reason}
              >
                {isLoading ? "Обработка..." : "Начислить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debit Modal */}
      {activeModal === "debit" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Списать вручную
            </h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                Текущий баланс: <span className="font-medium">{currentBalance.toFixed(2)} {currency}</span>
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сумма ({currency})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Причина *
                </label>
                <Input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Корректировка, штраф и т.д."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Примечание
                </label>
                <Textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={2}
                  placeholder="Дополнительная информация"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allowNegative"
                  checked={formData.allowNegative}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowNegative: checked === true })
                  }
                />
                <label htmlFor="allowNegative" className="text-sm text-gray-700">
                  Разрешить отрицательный баланс
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                onClick={() => handleAction("debit")}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                disabled={isLoading || !formData.amount || !formData.reason}
              >
                {isLoading ? "Обработка..." : "Списать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {activeModal === "suspend" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Приостановить аккаунт
            </h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">
                Аккаунт будет приостановлен. Бизнес не сможет использовать платные функции.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Причина *
                </label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  placeholder="Укажите причину приостановки"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                onClick={() => handleAction("suspend")}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                disabled={isLoading || !formData.reason}
              >
                {isLoading ? "Обработка..." : "Приостановить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Modal */}
      {activeModal === "reactivate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Восстановить аккаунт
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Аккаунт будет восстановлен и бизнес снова сможет использовать платные функции.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                onClick={() => handleAction("reactivate")}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Обработка..." : "Восстановить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recalculate Modal */}
      {activeModal === "recalculate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Пересчитать баланс
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Баланс будет пересчитан из ledger транзакций. Используйте эту функцию только если есть расхождения.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                onClick={() => handleAction("recalculate")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Обработка..." : "Пересчитать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
