"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditorOption = {
  id?: string;
  key: string;
  title: string;
  mode: "INCLUDED" | "OPTIONAL" | "STANDALONE";
  priceByn: string;
  bookingUnitId: string | null;
  active: boolean;
};
type Catalog = {
  revision: number;
  currency: string;
  bookingEnabled: boolean;
  bookingMode: string | null;
  resourceExtrasAllowed: boolean;
  basePriceByn: string | null;
  minimumDurationMinutes: number | null;
  durationExtensionAllowed: boolean;
  maxExtensionHours: number;
  extensionHourPriceByn: string | null;
  extensionDiscountPercent: number;
  options: Array<Omit<EditorOption, "key">>;
  units: Array<{ id: string; name: string }>;
  error?: string;
};
const formatOption = (o: Catalog["options"][number]): EditorOption => ({ ...o, key: o.id ?? "" });

/**
 * Operational prices are saved independently of publication copy/moderation.
 * The wizard's legacy catalog price, group tariffs and camp shift prices are
 * preserved; this edits only the actual booking price and optional extras.
 */
export function BookingServicesEditor({ offerId }: { offerId: string | null }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [base, setBase] = useState("");
  const [extensionHours, setExtensionHours] = useState(0);
  const [extensionRate, setExtensionRate] = useState("");
  const [extensionDiscount, setExtensionDiscount] = useState(0);
  const [options, setOptions] = useState<EditorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = async (signal?: AbortSignal) => {
    if (!offerId) return;
    const response = await fetch(`/api/business/offers/${encodeURIComponent(offerId)}/booking-services`,
      { signal, cache: "no-store" });
    const result = await response.json() as Catalog;
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить услуги");
    if (signal?.aborted) return;
    setCatalog(result);
    setBase(result.basePriceByn ?? "");
    setExtensionHours(result.maxExtensionHours ?? 0);
    setExtensionRate(result.extensionHourPriceByn ?? "");
    setExtensionDiscount(result.extensionDiscountPercent ?? 0);
    setOptions(result.options.map(formatOption));
    setDirty(false);
  };

  useEffect(() => {
    if (!offerId) return;
    const controller = new AbortController();
    setLoading(true);
    void refresh(controller.signal).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offerId]);

  if (!offerId) {
    return <p className="text-sm text-muted-foreground rounded-xl border px-4 py-3">
      Допуслуги и цена бронирования появятся здесь после первого сохранения предложения как черновика.
    </p>;
  }
  const setOption = (key: string, updates: Partial<EditorOption>) => {
    setOptions(old => old.map(o => o.key === key ? { ...o, ...updates } : o));
    setDirty(true); setMessage("");
  };
  const save = async () => {
    if (!catalog || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/business/offers/${encodeURIComponent(offerId)}/booking-services`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: catalog.revision,
          basePriceByn: base.trim() === "" ? null : base.trim().replace(",", "."),
          maxExtensionHours: extensionHours,
          extensionHourPriceByn: extensionHours > 0 ? extensionRate.trim().replace(",", ".") : null,
          extensionDiscountPercent: extensionHours > 0 ? extensionDiscount : 0,
          options: options.map(({ key: _key, ...option }) => ({
            ...option, priceByn: option.priceByn.trim().replace(",", "."),
          })),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        if (response.status === 409) await refresh();
        throw new Error(result.error ?? "Ошибка сохранения");
      }
      await refresh();
      setMessage("Услуги и стоимость сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить услуги");
    } finally { setSaving(false); }
  };

  return (
    <section aria-labelledby="booking-services-title" className="space-y-4 rounded-2xl border border-border/70 p-4">
      <div>
        <h3 id="booking-services-title" className="font-semibold text-lg">Услуги и стоимость бронирования</h3>
        <p className="text-sm text-muted-foreground">
          Основная стоимость, что входит и дополнительные услуги. Цены и состав выбираемых услуг
          фиксируются в заявке при записи. Изменения здесь сохраняются отдельно от текста предложения.
        </p>
      </div>
      {loading && <p role="status" className="text-sm text-muted-foreground">Загружаем цены…</p>}
      {catalog && (
        <>
          {!catalog.bookingEnabled && <p className="text-sm text-muted-foreground">
            Запись ещё не включена. Настройки сохранятся и будут использованы при подключении записи.
          </p>}
          {catalog.currency !== "BYN" ? (
            <p role="alert" className="text-sm text-destructive">
              Для записи с допуслугами нужна валюта BYN. Текущий режим сохранён без изменений.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="booking-base-price">Базовая стоимость, BYN</Label>
                <Input id="booking-base-price" inputMode="decimal" value={base}
                  placeholder="Цена по запросу"
                  onChange={e => { setBase(e.target.value); setDirty(true); setMessage(""); }}
                  disabled={saving} />
                <p className="text-xs text-muted-foreground">
                  Пустое значение — цена по запросу. Для занятий используется тариф группы,
                  если он выбран; его стоимость редактируется в расписании группы.
                </p>
              </div>
              {catalog.minimumDurationMinutes !== null && (
                <div className="space-y-3 rounded-xl border border-border/70 p-3">
                  <h4 className="font-medium">Продолжительность и дополнительные часы</h4>
                  <p className="text-sm text-muted-foreground">
                    Минимальная длительность: {catalog.minimumDurationMinutes} мин.
                    Её задаёт расписание услуги. Продление не изменяет цену базового времени.
                  </p>
                  {catalog.durationExtensionAllowed ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="booking-extension-hours">Максимум дополнительных часов</Label>
                        <select id="booking-extension-hours" value={extensionHours} disabled={saving}
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          onChange={event => {
                            const hours = Number(event.target.value);
                            setExtensionHours(hours); setDirty(true);
                            if (!hours) { setExtensionRate(""); setExtensionDiscount(0); }
                          }}>
                          {Array.from({ length: 9 }, (_, n) =>
                            <option key={n} value={n}>{n === 0 ? "Без продления" : n}</option>)}
                        </select>
                      </div>
                      {extensionHours > 0 && <>
                        <div className="space-y-1">
                          <Label htmlFor="booking-extension-rate">За дополнительный час, BYN</Label>
                          <Input id="booking-extension-rate" value={extensionRate} inputMode="decimal"
                            disabled={saving} placeholder="Например, 30.00"
                            onChange={event => { setExtensionRate(event.target.value); setDirty(true); }} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="booking-extension-discount">Скидка на доп. часы, %</Label>
                          <Input id="booking-extension-discount" type="number" min={0} max={90}
                            value={extensionDiscount} disabled={saving}
                            onChange={event => {
                              setExtensionDiscount(Math.max(0, Math.min(90, Number(event.target.value) || 0)));
                              setDirty(true);
                            }} />
                        </div>
                      </>}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">
                    Почасовое продление доступно для услуги с отдельными ресурсами
                    и расписанием по свободным временным окнам.
                  </p>}
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-medium">Состав услуги и допуслуги</h4>
                  <Button type="button" variant="outline" size="sm"
                    disabled={saving || options.length >= 20}
                    onClick={() => {
                      const key = `draft-${Date.now()}-${Math.random()}`;
                      setOptions(old => [...old, { key, title: "", mode: "OPTIONAL",
                        priceByn: "0.00", bookingUnitId: null, active: true }]);
                      setDirty(true);
                    }}>+ Допуслуга</Button>
                </div>
                {options.length === 0 && <p className="text-sm text-muted-foreground">
                  Допуслуг пока нет. Можно указать, что уже включено в основную цену.
                </p>}
                {options.map((option, index) => (
                  <div key={option.key} className="space-y-3 rounded-xl border border-border/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">Позиция {index + 1}</p>
                      <Button type="button" variant="ghost" size="sm" disabled={saving}
                        onClick={() => { setOptions(old => old.filter(o => o.key !== option.key)); setDirty(true); }}>
                        Удалить
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`option-title-${index}`}>Название</Label>
                      <Input id={`option-title-${index}`} value={option.title} maxLength={120}
                        onChange={e => setOption(option.key, { title: e.target.value })}
                        disabled={saving} placeholder="Например, проектор или оформление" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`option-mode-${index}`}>Тип</Label>
                        <select id={`option-mode-${index}`} value={option.mode} disabled={saving}
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          onChange={e => setOption(option.key, {
                            mode: e.target.value as EditorOption["mode"],
                            ...(e.target.value === "INCLUDED" ? { priceByn: "0.00" } : {}),
                            ...(e.target.value === "STANDALONE" ? { bookingUnitId: null } : {}),
                          })}>
                          <option value="INCLUDED">Включено в стоимость</option>
                          <option value="OPTIONAL">Дополнительная платная</option>
                          <option value="STANDALONE">Отдельное предложение</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`option-price-${index}`}>Стоимость, BYN</Label>
                        <Input id={`option-price-${index}`} inputMode="decimal"
                          value={option.priceByn} disabled={saving || option.mode === "INCLUDED"}
                          onChange={e => setOption(option.key, { priceByn: e.target.value })} />
                      </div>
                    </div>
                    {option.mode !== "STANDALONE" && catalog.resourceExtrasAllowed && (
                      <div className="space-y-1">
                        <Label htmlFor={`option-resource-${index}`}>Дополнительный ресурс (при необходимости)</Label>
                        <select id={`option-resource-${index}`} value={option.bookingUnitId ?? ""}
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          disabled={saving}
                          onChange={e => setOption(option.key, { bookingUnitId: e.target.value || null })}>
                          <option value="">Не нужен</option>
                          {catalog.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                        </select>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={option.active} disabled={saving}
                        onChange={e => setOption(option.key, { active: e.target.checked })} />
                      Доступно клиентам
                    </label>
                  </div>
                ))}
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {message && <p role="status" className="text-sm">{message}</p>}
              <div className="flex gap-2">
                <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
                  {saving ? "Сохраняем…" : "Сохранить услуги и стоимость"}
                </Button>
                {dirty && <Button type="button" variant="outline" disabled={saving}
                  onClick={() => { void refresh().catch(() => setError("Не удалось обновить данные")); }}>
                  Сбросить
                </Button>}
              </div>
              <p className="text-xs text-muted-foreground">
                Позиция «Отдельное предложение» не добавляется к этой брони —
                для неё нужно создать своё предложение. Цены лагерей и групповых тарифов не меняются.
              </p>
            </>
          )}
        </>
      )}
      {error && !catalog && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
