"use client";

import { useMemo, useState } from "react";
import { APPROVAL_LABELS, UI_LAB_CATALOG, type ApprovalStatus } from "@/lib/ui-lab/catalog";
import { Input } from "@/components/ui/input";

const labels: Record<string, string> = { common: "Общий", public: "Публичный", business: "Бизнес", admin: "Админка" };

export function CatalogSection() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => UI_LAB_CATALOG.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    return [row.title, row.source, row.note, labels[row.scope]].some((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
  }), [query, status]);

  return (
    <section id="catalog" className="space-y-5 scroll-mt-36">
      <div>
        <h2 className="text-2xl font-semibold">Реестр компонентов</h2>
        <p className="text-sm text-muted-foreground">Статус — решение о дизайн-стандарте, а не просто факт рендера. Ничего не утверждено автоматически.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 space-y-1 text-sm">
          <span>Найти компонент</span>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, файл или раздел" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Статус</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="flex h-10 w-full min-w-44 rounded-md border border-input bg-background px-3 text-base sm:text-sm">
            <option value="all">Все статусы</option>
            {Object.entries(APPROVAL_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-surface-muted text-muted-foreground"><tr><th className="px-3 py-3">Элемент</th><th className="px-3 py-3">Раздел</th><th className="px-3 py-3">Статус</th><th className="px-3 py-3">Что проверить</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id} className="border-t border-border align-top">
              <td className="px-3 py-3"><div className="font-medium">{row.title}</div><code className="text-xs text-muted-foreground break-all">{row.source}</code></td>
              <td className="px-3 py-3">{labels[row.scope]}</td>
              <td className="px-3 py-3"><span className={row.status === "approved" ? "text-success" : "text-muted-foreground"}>{APPROVAL_LABELS[row.status as ApprovalStatus]}</span></td>
              <td className="px-3 py-3 text-muted-foreground">{row.note}</td>
            </tr>)}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">Ничего не найдено</p>}
      </div>
    </section>
  );
}
