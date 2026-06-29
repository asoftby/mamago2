"use client";

import { useState, useEffect } from "react";
import { X, Search, Wallet } from "lucide-react";
import { BYN_SYMBOL, formatPrice } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

interface Business {
  id: string;
  name: string;
  ownerEmail: string | null;
  hasBillingAccount: boolean;
  currentBalance: number;
  currency: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function FirstTopUpModal({ onClose, onSuccess }: Props) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Пополнение баланса mamaGo");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [error, setError] = useState("");

  // Load businesses on mount
  useEffect(() => {
    loadBusinesses();
  }, []);

  // Filter businesses based on search
  useEffect(() => {
    if (!search.trim()) {
      setFilteredBusinesses(businesses);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(searchLower) ||
        b.ownerEmail?.toLowerCase().includes(searchLower)
    );
    setFilteredBusinesses(filtered);
  }, [search, businesses]);

  const loadBusinesses = async () => {
    try {
      setLoadingBusinesses(true);
      const response = await fetch("/api/admin/businesses/list");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load businesses");
      }

      setBusinesses(data.businesses);
      setFilteredBusinesses(data.businesses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки бизнесов");
    } finally {
      setLoadingBusinesses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBusiness) {
      setError("Выберите бизнес");
      return;
    }

    if (!note.trim()) {
      setError("Внутренний комментарий обязателен");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/billing/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedBusiness.id,
          amount: parseFloat(amount),
          reason,
          note,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to credit account");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при пополнении");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#EF8759]" />
            <h2 className="text-xl font-bold text-gray-900">Пополнить баланс</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Business Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Бизнес <span className="text-red-500">*</span>
              </label>
              
              {/* Search Input */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по названию или email..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#EF8759] focus:border-[#EF8759]"
                />
              </div>

              {/* Business List */}
              {loadingBusinesses ? (
                <div className="border border-gray-300 rounded-md p-4 text-center text-sm text-gray-500">
                  Загрузка бизнесов...
                </div>
              ) : filteredBusinesses.length === 0 ? (
                <div className="border border-gray-300 rounded-md p-4 text-center text-sm text-gray-500">
                  {search ? "Ничего не найдено" : "Нет доступных бизнесов"}
                </div>
              ) : (
                <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                  {filteredBusinesses.map((business) => (
                    <button
                      key={business.id}
                      type="button"
                      onClick={() => setSelectedBusiness(business)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-200 last:border-b-0 ${
                        selectedBusiness?.id === business.id
                          ? "bg-[#EF8759]/10 border-l-4 border-l-[#EF8759]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {business.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {business.ownerEmail || "—"}
                          </p>
                        </div>
                        {!business.hasBillingAccount && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            Новый
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Current Balance (readonly) */}
            {selectedBusiness && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Текущий баланс
                </label>
                <input
                  type="text"
                  value={formatPrice(selectedBusiness.currentBalance)}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                />
                {!selectedBusiness.hasBillingAccount && (
                  <p className="mt-1 text-xs text-blue-600">
                    Billing-аккаунт будет создан автоматически
                  </p>
                )}
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сумма пополнения <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#EF8759] focus:border-[#EF8759]"
                  placeholder="100.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  {renderCurrencyText(BYN_SYMBOL, { iconSize: "sm" })}
                </span>
              </div>
            </div>

            {/* Public Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Публичное описание <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#EF8759] focus:border-[#EF8759]"
                placeholder="Пополнение баланса mamaGo"
              />
              <p className="mt-1 text-xs text-gray-500">
                Это описание увидит бизнес в истории операций
              </p>
            </div>

            {/* Internal Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Внутренний комментарий администратора <span className="text-red-500">*</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#EF8759] focus:border-[#EF8759]"
                placeholder="Например: Оплата по счёту №123"
              />
              <p className="mt-1 text-xs text-gray-500">
                Только для внутреннего использования, бизнес не увидит
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </form>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !selectedBusiness}
            className="flex-1 px-4 py-2 bg-[#EF8759] text-white rounded-md hover:bg-[#EF8759]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Пополнение..." : "Пополнить"}
          </button>
        </div>
      </div>
    </div>
  );
}
