"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";

interface OnboardingStartProps {
  onAddChild?: (data: { name: string; month: number; year: number }) => void;
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

export function OnboardingStart({ onAddChild }: OnboardingStartProps) {
  const [name, setName] = useState("");
  const [month, setMonth] = useState<number | "">("");
  const [year, setYear] = useState<number | "">("");

  const canProceed = month !== "" && year !== "";

  const handleProceed = () => {
    if (canProceed && typeof month === "number" && typeof year === "number") {
      onAddChild?.({ name, month, year });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">
              Соберем план для вашей семьи
            </h1>
            <p className="text-base text-gray-600 whitespace-nowrap">
              Укажи ребенка и мы покажем, где будет ему интересно
            </p>
          </div>

          {/* Child Input Form */}
          <div className="space-y-4">
            <div className="space-y-3">
              <Input
                placeholder="Имя ребенка"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />

              <div className="flex gap-3 justify-center">
                <Select value={month === "" ? undefined : month.toString()} onValueChange={(value) => setMonth(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Месяц" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={year === "" ? undefined : year.toString()} onValueChange={(value) => setYear(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Год" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Proceed Button */}
          <Button
            onClick={handleProceed}
            disabled={!canProceed}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            Показать варианты
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}