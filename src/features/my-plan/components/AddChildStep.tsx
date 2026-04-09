"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";
import { cn } from "@/lib/utils";
import { BIRTH_MONTH_OPTIONS, getBirthYearOptions } from "@/lib/child/birthDateSelectOptions";

interface AddChildStepProps {
  submitting?: boolean;
  serverError?: string | null;
  onSubmit: (data: {
    name: string;
    birthMonth: number;
    birthYear: number;
    systemInterests: string[];
  }) => void | Promise<void>;
}

export function AddChildStep({ submitting, serverError, onSubmit }: AddChildStepProps) {
  const birthYears = getBirthYearOptions(20);
  const [name, setName] = useState("");
  const [month, setMonth] = useState<number | "">("");
  const [year, setYear] = useState<number | "">("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length >= 2;
  const dateOk = month !== "" && year !== "";
  const canSave = nameOk && dateOk && !submitting;

  function toggleInterest(slug: string) {
    setInterests((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function handleSave() {
    setError(null);
    if (!nameOk) {
      setError("Введите имя (не менее 2 символов)");
      return;
    }
    if (month === "" || year === "") {
      setError("Укажите месяц и год рождения");
      return;
    }
    await onSubmit({
      name: name.trim(),
      birthMonth: month,
      birthYear: year,
      systemInterests: interests,
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Добавьте ребенка</h2>
            <p className="text-sm text-gray-600">
              Мы подберем события и места под возраст и интересы
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Имя <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Как зовут ребенка"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
                autoComplete="off"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-gray-600 mb-1.5">
                Дата рождения <span className="text-red-500">*</span>
              </span>
              <div className="flex gap-3 flex-wrap">
                <Select
                  value={month === "" ? undefined : String(month)}
                  onValueChange={(value) => setMonth(parseInt(value, 10))}
                >
                  <SelectTrigger className="min-w-[140px] flex-1">
                    <SelectValue placeholder="Месяц" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[110]">
                    {BIRTH_MONTH_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={year === "" ? undefined : String(year)}
                  onValueChange={(value) => setYear(parseInt(value, 10))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Год" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[110]">
                    {birthYears.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-gray-600 mb-2">
                Интересы{" "}
                <span className="text-gray-400 font-normal">(по желанию)</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {SYSTEM_INTERESTS.map((it) => {
                  const on = interests.includes(it.slug);
                  return (
                    <button
                      key={it.slug}
                      type="button"
                      onClick={() => toggleInterest(it.slug)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-[#EF8759] bg-[#EF8759]/10 text-neutral-900"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                      )}
                    >
                      {it.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {(error || serverError) && (
            <p className="text-sm text-red-500 text-center">{error ?? serverError}</p>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 px-6 py-4 border-t bg-white">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800"
        >
          {submitting ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}
