"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { BYN_SYMBOL, formatPrice } from "@/lib/formatters/format-price";
import { QUICK_TOPUP_AMOUNTS } from "@/services/billing/mock";

interface QuickTopUpBlockProps {
  onGenerateInvoice: (amount: number) => void;
  disabled?: boolean;
}

export function QuickTopUpBlock({ onGenerateInvoice, disabled = false }: QuickTopUpBlockProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const handleSubmit = () => {
    const amount = selectedAmount || parseFloat(customAmount);
    if (amount && amount > 0) {
      onGenerateInvoice(amount);
    }
  };

  const isValid = (selectedAmount && selectedAmount > 0) || (customAmount && parseFloat(customAmount) > 0);

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-stone-950 mb-4">Пополнить баланс</h3>

      {/* Quick Amounts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {QUICK_TOPUP_AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => handleAmountSelect(amount)}
            disabled={disabled}
            className={`
              px-4 py-3 rounded-xl font-medium transition-all
              ${
                selectedAmount === amount
                  ? "bg-[#EF8759] text-white shadow-md"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            {formatPrice(amount, { hideZero: true })}
          </button>
        ))}
      </div>

      {/* Custom Amount */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Или введите свою сумму
        </label>
        <div className="relative">
          <input
            type="number"
            min="1"
            step="0.01"
            value={customAmount}
            onChange={(e) => handleCustomAmountChange(e.target.value)}
            disabled={disabled}
            placeholder="Введите сумму"
            className="
              w-full px-4 py-3 pr-16 rounded-xl border border-stone-300
              focus:ring-2 focus:ring-[#EF8759] focus:border-[#EF8759]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 font-medium">
            {BYN_SYMBOL}
          </span>
        </div>
      </div>

      {/* Generate Invoice Button */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || disabled}
        className="
          w-full inline-flex items-center justify-center gap-2 px-6 py-3
          bg-stone-900 text-white font-medium rounded-xl
          hover:bg-stone-800 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        <FileText className="w-5 h-5" />
        Сформировать счет
      </button>

      <p className="text-xs text-stone-500 mt-3 text-center">
        После формирования счета вы сможете оплатить его удобным способом
      </p>
    </div>
  );
}
