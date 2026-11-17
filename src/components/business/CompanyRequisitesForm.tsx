"use client";

import { useEffect, useState } from "react";
import { normalizeOtherPayerType } from "@/lib/business/registrationIdentity";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PayerType = "LEGAL_ENTITY" | "SOLE_PROPRIETOR" | "SELF_EMPLOYED";
type Form = {
  payerType: PayerType; legalName: string; unp: string; legalAddress: string;
  bankName: string; bankCode: string; bankAccount: string;
  contactName: string; contactEmail: string; contactPhone: string;
  signatoryName: string; signatoryPosition: string; signatoryBasis: string;
};
const empty: Form = {
  payerType: "LEGAL_ENTITY", legalName: "", unp: "", legalAddress: "",
  bankName: "", bankCode: "", bankAccount: "", contactName: "", contactEmail: "",
  contactPhone: "", signatoryName: "", signatoryPosition: "", signatoryBasis: "",
};
const fields: { name: keyof Omit<Form, "payerType">; label: string }[] = [
  { name: "legalName", label: "Юридическое название / ФИО" },
  { name: "unp", label: "УНП" },
  { name: "legalAddress", label: "Юридический адрес" },
  { name: "bankName", label: "Банк" },
  { name: "bankCode", label: "БИК" },
  { name: "bankAccount", label: "Расчётный счёт" },
  { name: "contactName", label: "Контактное лицо" },
  { name: "contactEmail", label: "Email для документов" },
  { name: "contactPhone", label: "Телефон" },
  { name: "signatoryName", label: "ФИО подписанта" },
  { name: "signatoryPosition", label: "Должность" },
  { name: "signatoryBasis", label: "Основание полномочий" },
];
export function CompanyRequisitesForm() {
  const [identityMode, setIdentityMode] = useState("BUSINESS");
  const [businessIdentity, setBusinessIdentity] = useState({ payerType: "UNSPECIFIED", legalName: "", unp: "" });
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/business/billing/payer-profile", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Не удалось загрузить реквизиты");
        return response.json();
      })
      .then(({ profile, businessIdentity, identityMode }) => {
        if (active) { setIdentityMode(identityMode); setBusinessIdentity(businessIdentity); }
        if (active && profile) setForm({ ...empty, ...Object.fromEntries(Object.keys(empty).map(key => [key, profile[key] ?? ""])), payerType: normalizeOtherPayerType(profile.payerType) } as Form);
      })
      .catch(() => { if (active) { setLoadFailed(true); setError("Не удалось загрузить реквизиты. Обновите страницу."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || identityMode === "LEGACY_REVIEW") return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/business/billing/payer-profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, identityMode, unp: form.unp || undefined, legalAddress: form.legalAddress || undefined }),
      });
      if (!response.ok) throw new Error("Проверьте реквизиты и повторите сохранение");
      toast.success("Реквизиты сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  }
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-stone-950">Реквизиты для документов</h2>
        <p className="text-sm text-stone-600">
          Регистрационные данные берутся из профиля бизнеса. Другого плательщика можно указать отдельно.
        </p>
      </div>
      {loading ? <p role="status">Загрузка реквизитов…</p> : (
        <form onSubmit={save} className="max-w-3xl space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
          <label className="block text-sm font-medium">Кто оплачивает услуги mamaGo?
            <select aria-label="Кто оплачивает услуги mamaGo?" value={identityMode} onChange={e => setIdentityMode(e.target.value)} className="mt-1 block w-full rounded-md border border-border bg-surface p-3 text-base">
              {identityMode === "LEGACY_REVIEW" && <option value="LEGACY_REVIEW">Уточните плательщика — прежние данные сохранены</option>}
              <option value="BUSINESS">Моя компания / я сам</option><option value="OTHER">Другое юридическое или физическое лицо</option>
            </select>
          </label>
          {identityMode === "LEGACY_REVIEW" && <p role="status">Прежние реквизиты сохранены без изменений. Укажите, кому они принадлежат. Выбор «Моя компания / я сам» заменит регистрационные поля ссылкой на ваш бизнес.</p>}
          {identityMode === "BUSINESS" && <p>{businessIdentity.legalName || "Тип деятельности не уточнён"} · УНП {businessIdentity.unp || "не указан"}</p>}
          {identityMode !== "BUSINESS" && <label className="block text-sm font-medium">Тип плательщика
            <select value={form.payerType} onChange={e => setForm(prev => ({ ...prev, payerType: e.target.value as PayerType }))} className="mt-1 block w-full rounded-md border border-border bg-surface p-3 text-base">
              <option value="LEGAL_ENTITY">Юридическое лицо</option><option value="SOLE_PROPRIETOR">ИП</option><option value="SELF_EMPLOYED">Самозанятый</option>
            </select>
          </label>}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.filter(field => identityMode !== "BUSINESS" || !["legalName", "unp"].includes(field.name)).map(field => {
              const required = identityMode !== "BUSINESS" && (field.name === "legalName" || (field.name === "unp" && form.payerType !== "SELF_EMPLOYED") || (field.name === "legalAddress" && form.payerType === "LEGAL_ENTITY"));
              return <label key={field.name} className="block text-sm font-medium">{field.label}{required ? " *" : ""}
                <Input className="mt-1 text-base" value={form[field.name]} onChange={e => setForm(prev => ({ ...prev, [field.name]: e.target.value }))} required={required} maxLength={field.name === "legalAddress" ? 500 : 250} type={field.name === "contactEmail" ? "email" : "text"} />
              </label>;
            })}
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={saving || loadFailed || identityMode === "LEGACY_REVIEW"} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Сохранение…" : "Сохранить реквизиты"}</Button>
        </form>
      )}
    </section>
  );
}
