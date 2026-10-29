"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newClassScheduleId, type ClassSessionGroup } from "@/lib/offers/offerClassSchedule";
import type { OfferFormData } from "../types";

/** Same OfferClassGroup tariff objects used by schedule; no shadow pricing state. */
export function ClassTariffsEditor({ data, onChange, isEditable }: {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}) {
  const updateGroup = (id: string, patch: Partial<ClassSessionGroup>) => {
    onChange({ schedule: {
      ...data.schedule, classSchedule: {
        ...data.schedule.classSchedule,
        groups: data.schedule.classSchedule.groups.map(group => group.id === id
          ? { ...group, ...patch } : group),
      },
    } });
  };
  return (
    <section className="space-y-4" aria-label="Тарифы занятий">
      <div>
        <h2 className="text-xl font-semibold">Тарифы групп</h2>
        <p className="text-sm text-muted-foreground">
          Группы, время и количество мест настраиваются в «Расписании».
          Тарифы каждой группы редактируются здесь и сохраняются в тех же данных — без дублей.
        </p>
      </div>
      {data.schedule.classSchedule.groups.length === 0 &&
        <p className="text-sm text-muted-foreground">
          Сначала добавьте группу на шаге «Расписание», затем вернитесь сюда для цены.
        </p>}
      {data.schedule.classSchedule.groups.map((group, groupIndex) => (
        <div key={group.id} className="space-y-3 rounded-xl border border-border/70 p-3">
          <h3 className="font-medium">{group.title?.trim() || `Группа ${groupIndex + 1}`}</h3>
          {(group.tariffs ?? []).map((tariff, index) => (
            <div key={tariff.id} className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Тариф {index + 1}</span>
                <Button type="button" size="sm" variant="ghost" disabled={!isEditable}
                  onClick={() => updateGroup(group.id, {
                    tariffs: (group.tariffs ?? []).filter(item => item.id !== tariff.id),
                  })}>Удалить</Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ["title", "Название", tariff.title],
                  ["price", "Цена, BYN", tariff.price],
                  ["unit", "Единица", tariff.unit],
                ] as const).map(([field, label, value]) => (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={`tariff-${group.id}-${tariff.id}-${field}`}>{label}</Label>
                    <Input id={`tariff-${group.id}-${tariff.id}-${field}`} value={value}
                      disabled={!isEditable} onChange={event => updateGroup(group.id, {
                        tariffs: (group.tariffs ?? []).map(item => item.id === tariff.id
                          ? { ...item, [field]: event.target.value } : item),
                      })} />
                  </div>
                ))}
                {([
                  ["periodDays", "Дней", tariff.periodDays],
                  ["visitsCount", "Посещений", tariff.visitsCount],
                ] as const).map(([field, label, value]) => (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={`tariff-${group.id}-${tariff.id}-${field}`}>{label}</Label>
                    <Input id={`tariff-${group.id}-${tariff.id}-${field}`} type="number" min={1}
                      max={field === "periodDays" ? 366 : 365}
                      value={value ?? ""} disabled={!isEditable}
                      onChange={event => updateGroup(group.id, {
                        tariffs: (group.tariffs ?? []).map(item => item.id === tariff.id
                          ? { ...item, [field]: event.target.value ? Number(event.target.value) : null } : item),
                      })} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline"
            disabled={!isEditable || (group.tariffs?.length ?? 0) >= 12}
            onClick={() => updateGroup(group.id, { tariffs: [
              ...(group.tariffs ?? []),
              { id: newClassScheduleId(), title: "", price: "", unit: "занятие",
                periodDays: null, visitsCount: 1 },
            ] })}>
            + Добавить тариф
          </Button>
        </div>
      ))}
    </section>
  );
}
