"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { X, Plus, ChevronRight } from "lucide-react";
import type { OnboardingChild } from "../../hooks/useMyPlan";

interface OnboardingChildStepProps {
  children: OnboardingChild[];
  onAddChild: (child: OnboardingChild) => void;
  onRemoveChild: (childId: string) => void;
  onNext: () => void;
}

const MONTHS = [
  { value: 1, label: "Январь" },
  { value: 2, label: "Февраль" },
  { value: 3, label: "Март" },
  { value: 4, label: "Апрель" },
  { value: 5, label: "Май" },
  { value: 6, label: "Июнь" },
  { value: 7, label: "Июль" },
  { value: 8, label: "Август" },
  { value: 9, label: "Сентябрь" },
  { value: 10, label: "Октябрь" },
  { value: 11, label: "Ноябрь" },
  { value: 12, label: "Декабрь" },
];

const YEARS = Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i);

export function OnboardingChildStep({
  children,
  onAddChild,
  onRemoveChild,
  onNext,
}: OnboardingChildStepProps) {
  const [name, setName] = useState("");
  const [month, setMonth] = useState<number | "">(new Date().getMonth() + 1);
  const [year, setYear] = useState<number | "">(new Date().getFullYear());

  const canAddChild = month !== "" && year !== "";

  const handleAddChild = () => {
    if (month && year) {
      onAddChild({
        id: Date.now().toString(),
        name: name || "Ребенок",
        birthMonth: month,
        birthYear: year,
      });
      setName("");
      setMonth(new Date().getMonth() + 1);
      setYear(new Date().getFullYear());
    }
  };

  const isNextDisabled = children.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Добавьте детей</h2>
          <p className="text-gray-600">Укажите месяц и год рождения, чтобы мы подобрали подходящие места</p>
        </div>

        {/* Added Children List */}
        {children.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Добавленные дети</p>
            {children.map((child) => {
              const monthLabel = MONTHS.find(m => m.value === child.birthMonth)?.label;
              const age = new Date().getFullYear() - child.birthYear;
              return (
                <div
                  key={child.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{child.name}</p>
                    <p className="text-xs text-gray-500">
                      {monthLabel} {child.birthYear}, {age} {["год", "года", "лет"][
                        age % 10 === 1 && age % 100 !== 11 ? 0 : age % 10 >= 2 && age % 10 <= 4 && (age % 100 < 10 || age % 100 >= 20) ? 1 : 2
                      ]}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveChild(child.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Child Form */}
        <div className="space-y-4 p-4 rounded-2xl bg-gray-50 border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Имя ребенка (опционально)</label>
            <Input
              type="text"
              placeholder="Например, Маша"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Месяц рождения</label>
              <FilterSelect
                value={month === "" ? "" : String(month)}
                placeholder="Выберите месяц"
                options={MONTHS.map((m) => ({
                  value: String(m.value),
                  label: m.label,
                }))}
                onChange={(v) => setMonth(v === "" ? "" : Number(v))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Год рождения</label>
              <FilterSelect
                value={year === "" ? "" : String(year)}
                placeholder="Выберите год"
                options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
                onChange={(v) => setYear(v === "" ? "" : Number(v))}
              />
            </div>
          </div>

          <Button
            onClick={handleAddChild}
            disabled={!canAddChild}
            variant="outline"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить ребенка
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Вы можете добавить еще детей позже в настройках профиля
        </p>
      </div>

      {/* CTA Button */}
      <div className="flex-shrink-0 px-6 py-4 border-t bg-white">
        <Button
          onClick={onNext}
          disabled={isNextDisabled}
          className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
        >
          Далее
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
