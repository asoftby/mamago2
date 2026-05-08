"use client";

import { Building2, FileText, CheckCircle2 } from "lucide-react";

interface RequisitesEmptyStateProps {
  onFillRequisites: () => void;
}

export function RequisitesEmptyState({
  onFillRequisites,
}: RequisitesEmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-[#EF8759]/10 flex items-center justify-center mx-auto mb-6">
        <Building2 className="w-8 h-8 text-[#EF8759]" />
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-stone-950 mb-3">
        Заполните реквизиты
      </h2>

      {/* Description */}
      <p className="text-sm text-stone-600 max-w-md mx-auto mb-6">
        Они используются для автоматического формирования счетов и актов
      </p>

      {/* Benefits List */}
      <div className="max-w-sm mx-auto mb-8 space-y-3">
        <div className="flex items-start gap-3 text-left">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-stone-950">
              Автоматическое формирование счетов
            </p>
            <p className="text-xs text-stone-500">
              Счета на оплату создаются мгновенно
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 text-left">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-stone-950">
              Акты выполненных работ
            </p>
            <p className="text-xs text-stone-500">
              Закрывающие документы в один клик
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 text-left">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-stone-950">
              Готовые документы для бухгалтерии
            </p>
            <p className="text-xs text-stone-500">
              Все документы соответствуют требованиям РБ
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onFillRequisites}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#EF8759] text-white text-sm font-medium rounded-xl hover:bg-[#EF8759]/90 transition-colors shadow-sm"
      >
        <FileText className="w-4 h-4" />
        Заполнить реквизиты
      </button>
    </div>
  );
}
