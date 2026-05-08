"use client";

import { Building2, CreditCard, Mail, User, Edit2 } from "lucide-react";
import type { BillingProfile } from "@/types/billing";
import { getCompletenessLabel, getCompletenessColor } from "@/types/billing";

interface RequisitesCardProps {
  profile: BillingProfile;
  onEdit: () => void;
}

export function RequisitesCard({ profile, onEdit }: RequisitesCardProps) {
  const completenessLabel = getCompletenessLabel(profile.completeness);
  const completenessColor = getCompletenessColor(profile.completeness);

  // Status icon
  const statusIcon =
    profile.completeness === "complete"
      ? "🟢"
      : profile.completeness === "partial"
        ? "🟠"
        : "🔴";

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EF8759]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#EF8759]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-950">
                Реквизиты компании
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm">{statusIcon}</span>
                <span className={`text-sm font-medium ${completenessColor}`}>
                  {completenessLabel}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Редактировать
          </button>
        </div>

        {profile.isVerified && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              ✓ Реквизиты проверены и подтверждены
            </p>
          </div>
        )}
      </div>

      {/* Company Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-stone-700" />
          <h3 className="text-base font-semibold text-stone-950">Компания</h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-stone-500 mb-1">Юридическое название</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.legalName || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">УНП</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.unp || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Юридический адрес</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.legalAddress || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Bank Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-stone-700" />
          <h3 className="text-base font-semibold text-stone-950">
            Банковские реквизиты
          </h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-stone-500 mb-1">Банк</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.bankName || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">БИК</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.bankCode || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Расчётный счёт</p>
            <p className="text-sm text-stone-950 font-mono">
              {profile.accountNumber || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-stone-700" />
          <h3 className="text-base font-semibold text-stone-950">
            Контакт для документов
          </h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-stone-500 mb-1">Контактное лицо</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.contactName || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Email</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.contactEmail || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Телефон</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.contactPhone || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Signatory Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-stone-700" />
          <h3 className="text-base font-semibold text-stone-950">Подписант</h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-stone-500 mb-1">ФИО</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.signatoryName || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Должность</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.signatoryPosition || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Основание</p>
            <p className="text-sm text-stone-950 font-medium">
              {profile.signatoryBasis || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
