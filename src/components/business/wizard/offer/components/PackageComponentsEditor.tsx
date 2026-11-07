"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PackageComponentFormRow, PartyCategory } from "../types";

const categories: Array<[PartyCategory, string]> = [
  ["VENUE", "Площадка"], ["ANIMATOR", "Аниматор"], ["CAKE", "Торт"], ["DECOR", "Декор"],
  ["SHOW", "Шоу"], ["FOOD", "Еда"], ["PHOTO", "Фотограф"], ["MASTER_CLASS", "Мастер-класс"],
  ["PROGRAM", "Программа"], ["OTHER", "Другое"],
];
const policies: Array<[NonNullable<PackageComponentFormRow["removalPolicy"]>, string, string]> = [
  ["REQUIRED", "Обязательный компонент", "Родитель не может убрать услугу."],
  ["REMOVABLE_NO_REFUND", "Можно убрать без уменьшения цены", "Цена пакета останется прежней."],
  ["REMOVABLE_FIXED_CREDIT", "Можно убрать с фиксированным уменьшением", "Укажите сумму в BYN. Нужна точная цена пакета, покрывающая все уменьшения."],
  ["REMOVABLE_QUOTE_REQUIRED", "Изменение требует согласования", "Родитель сохраняет запрос, новая цена требует вашего предложения и принятия родителем."],
];

export function PackageComponentsEditor({ rows, disabled, onChange }: {
  rows: PackageComponentFormRow[]; disabled: boolean; onChange: (rows: PackageComponentFormRow[]) => void;
}) {
  const update = (index: number, patch: Partial<PackageComponentFormRow>) =>
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  return <section className="min-w-0 space-y-3" aria-label="Компоненты пакета">
    <h3 className="font-semibold">Состав и правила пакета</h3>
    <p className="text-sm text-muted-foreground">Для каждого компонента укажите условия изменения. Правила опубликованного пакета проходят модерацию. Старые заказы сохраняют свои условия.</p>
    {rows.map((row, index) => <fieldset key={row.id ?? index} disabled={disabled} className="min-w-0 space-y-3 rounded-md border border-border p-3">
      <legend className="px-1 text-sm">Компонент {index + 1}</legend>
      <label className="grid min-w-0 gap-1 text-sm">Название
        <Input value={row.title} maxLength={200} onChange={event => update(index, { title: event.target.value })} className="text-base" />
      </label>
      <label className="grid min-w-0 gap-1 text-sm">Услуга
        <select value={row.category} onChange={event => update(index, { category: event.target.value as PartyCategory })}
          className="w-full min-w-0 rounded-md border bg-background p-2 text-base">
          {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm">Правило изменения
        <select value={row.removalPolicy ?? ""} onChange={event => update(index, {
          removalPolicy: event.target.value as PackageComponentFormRow["removalPolicy"] || null, removalCreditByn: null,
        })} className="w-full min-w-0 rounded-md border bg-background p-2 text-base">
          <option value="">Правило не задано — требуется согласование</option>
          {policies.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">{policies.find(([key]) => key === row.removalPolicy)?.[2] ?? "Автоматическое уменьшение стоимости недоступно."}</p>
      {row.removalPolicy === "REMOVABLE_FIXED_CREDIT" && <label className="grid gap-1 text-sm">Уменьшение в BYN
        <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={row.removalCreditByn ?? ""}
          onChange={event => update(index, { removalCreditByn: event.target.value || null })} className="text-base" />
      </label>}
      <Button type="button" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}>Удалить из пакета</Button>
    </fieldset>)}
    <Button type="button" variant="outline" disabled={disabled || rows.length >= 30} className="h-auto min-h-9 max-w-full whitespace-normal"
      onClick={() => onChange([...rows, { title: "", category: "OTHER", removalPolicy: "REQUIRED", removalCreditByn: null }])}>Добавить компонент</Button>
  </section>;
}
