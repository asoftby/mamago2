"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

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
export default function BillingRequisitesPage() {
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/business/billing/payer-profile", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Не удалось загрузить реквизиты");
        return response.json();
      })
      .then(({ profile }) => {
        if (active && profile) setForm({ ...empty, ...Object.fromEntries(Object.keys(empty).map(key => [key, profile[key] ?? ""])) } as Form);
      })
      .catch(() => { if (active) setError("Не удалось загрузить реквизиты. Обновите страницу."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/business/billing/payer-profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, unp: form.unp || undefined, legalAddress: form.legalAddress || undefined }),
      });
      if (!response.ok) throw new Error("Проверьте реквизиты и повторите сохранение");
      toast.success("Реквизиты сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="text-2xl font-semibold">Реквизиты для документов</h1><p className="text-sm text-stone-600 mt-2">Данные плательщика для счетов и актов. Изменения не затрагивают публичный профиль компании.</p></div>
      {loading ? <p role="status">Загрузка реквизитов…</p> : (
        <form onSubmit={save} className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
          <label className="block text-sm font-medium">Тип плательщика
            <select value={form.payerType} onChange={e => setForm(prev => ({ ...prev, payerType: e.target.value as PayerType }))} className="mt-1 block w-full rounded-lg border border-stone-300 p-2">
              <option value="LEGAL_ENTITY">Юридическое лицо</option><option value="SOLE_PROPRIETOR">ИП</option><option value="SELF_EMPLOYED">Самозанятый</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(field => {
              const required = field.name === "legalName" || (field.name === "unp" && form.payerType !== "SELF_EMPLOYED") || (field.name === "legalAddress" && form.payerType === "LEGAL_ENTITY");
              return <label key={field.name} className="block text-sm font-medium">{field.label}{required ? " *" : ""}
                <input className="mt-1 block w-full rounded-lg border border-stone-300 p-2" value={form[field.name]} onChange={e => setForm(prev => ({ ...prev, [field.name]: e.target.value }))} required={required} maxLength={field.name === "legalAddress" ? 500 : 250} type={field.name === "contactEmail" ? "email" : "text"} />
              </label>;
            })}
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={saving} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Сохранение…" : "Сохранить реквизиты"}</button>
        </form>
      )}
    </div>
  );
}
