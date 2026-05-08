"use client";

import { X, Building2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { BUSINESS_BILLING_REQUISITES_HREF } from "@/lib/business/navigation";

interface FirstTopUpModalProps {
  onClose: () => void;
}

export function FirstTopUpModal({ onClose }: FirstTopUpModalProps) {
  const router = useRouter();

  const handleFillRequisites = () => {
    onClose();
    router.push(BUSINESS_BILLING_REQUISITES_HREF);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-topup-modal-title"
      aria-describedby="first-topup-modal-description"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 id="first-topup-modal-title" className="text-xl font-bold text-stone-950">
              Заполните реквизиты
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p id="first-topup-modal-description" className="text-stone-700 mb-4">
            Перед пополнением баланса необходимо заполнить реквизиты вашей компании.
          </p>

          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-6">
            <p className="text-sm text-blue-900 font-medium mb-2">
              Реквизиты нужны для автоматического формирования:
            </p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Счетов на оплату</span>
              </li>
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Актов выполненных работ</span>
              </li>
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Закрывающих документов</span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-stone-600 mb-6">
            Заполнение займет всего несколько минут. После этого вы сможете пополнить баланс.
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="
                flex-1 px-4 py-3 rounded-xl font-medium
                bg-stone-100 text-stone-700
                hover:bg-stone-200 transition-colors
              "
            >
              Отмена
            </button>
            <button
              onClick={handleFillRequisites}
              className="
                flex-1 px-4 py-3 rounded-xl font-medium
                bg-[#EF8759] text-white
                hover:bg-[#EF8759]/90 transition-colors
              "
            >
              Заполнить реквизиты
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
