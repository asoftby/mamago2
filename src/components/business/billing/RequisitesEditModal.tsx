"use client";

import { useState } from "react";
import { X, Building2, CreditCard, Mail, User } from "lucide-react";
import type { BillingProfile, BillingProfileFormData } from "@/types/billing";
import { toast } from "sonner";

interface RequisitesEditModalProps {
  profile?: BillingProfile;
  onClose: () => void;
  onSave: (data: BillingProfileFormData) => void;
}

export function RequisitesEditModal({
  profile,
  onClose,
  onSave,
}: RequisitesEditModalProps) {
  const [formData, setFormData] = useState<BillingProfileFormData>({
    // Company
    legalName: profile?.legalName || "",
    unp: profile?.unp || "",
    legalAddress: profile?.legalAddress || "",
    // Bank
    bankName: profile?.bankName || "",
    bankCode: profile?.bankCode || "",
    accountNumber: profile?.accountNumber || "",
    // Contact
    contactName: profile?.contactName || "",
    contactEmail: profile?.contactEmail || "",
    contactPhone: profile?.contactPhone || "",
    // Signatory
    signatoryName: profile?.signatoryName || "",
    signatoryPosition: profile?.signatoryPosition || "",
    signatoryBasis: profile?.signatoryBasis || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.legalName || !formData.unp) {
      toast.error("Заполните обязательные поля");
      return;
    }

    onSave(formData);
    toast.success("Реквизиты сохранены");
    onClose();
  };

  const handleChange = (field: keyof BillingProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="requisites-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
          <h2 id="requisites-modal-title" className="text-xl font-bold text-stone-950">
            {profile ? "Редактировать реквизиты" : "Заполнить реквизиты"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-stone-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Company Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-stone-700" />
              <h3 className="text-base font-semibold text-stone-950">
                Компания
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Юридическое название <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.legalName}
                  onChange={(e) => handleChange("legalName", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder='ООО "Детский центр развития"'
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  УНП <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.unp}
                  onChange={(e) => handleChange("unp", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="123456789"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Юридический адрес
                </label>
                <input
                  type="text"
                  value={formData.legalAddress}
                  onChange={(e) => handleChange("legalAddress", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="г. Минск, ул. Ленина, д. 1, оф. 101"
                />
              </div>
            </div>
          </div>

          {/* Bank Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-stone-700" />
              <h3 className="text-base font-semibold text-stone-950">
                Банковские реквизиты
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Банк
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleChange("bankName", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder='ОАО "Беларусбанк"'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  БИК
                </label>
                <input
                  type="text"
                  value={formData.bankCode}
                  onChange={(e) => handleChange("bankCode", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="AKBBBY2X"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Расчётный счёт
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => handleChange("accountNumber", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent font-mono"
                  placeholder="BY86AKBB30120000000000000933"
                />
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-stone-700" />
              <h3 className="text-base font-semibold text-stone-950">
                Контакт для документов
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Контактное лицо
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => handleChange("contactName", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="Иванов Иван Иванович"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange("contactEmail", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="ivanov@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange("contactPhone", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="+375 29 123 45 67"
                />
              </div>
            </div>
          </div>

          {/* Signatory Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-stone-700" />
              <h3 className="text-base font-semibold text-stone-950">
                Подписант
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  ФИО
                </label>
                <input
                  type="text"
                  value={formData.signatoryName}
                  onChange={(e) => handleChange("signatoryName", e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="Петров Петр Петрович"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Должность
                </label>
                <input
                  type="text"
                  value={formData.signatoryPosition}
                  onChange={(e) =>
                    handleChange("signatoryPosition", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="Директор"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Основание
                </label>
                <input
                  type="text"
                  value={formData.signatoryBasis}
                  onChange={(e) =>
                    handleChange("signatoryBasis", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
                  placeholder="Устав"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#EF8759] rounded-lg hover:bg-[#EF8759]/90 transition-colors"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
