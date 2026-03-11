"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";

interface ImprovementRequestFormProps {
  placeId: string;
  onSuccess?: () => void;
}

const SEVERITY_OPTIONS = [
  { value: "LOW", label: "Низкая", description: "Косметические улучшения" },
  { value: "MEDIUM", label: "Средняя", description: "Желательные улучшения" },
  { value: "HIGH", label: "Высокая", description: "Важные исправления" },
  { value: "CRITICAL", label: "Критическая", description: "Требует немедленного внимания" },
];

export function ImprovementRequestForm({
  placeId,
  onSuccess,
}: ImprovementRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [severity, setSeverity] = useState<string>("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date and time into ISO string if both are provided
      let dueAtISO: string | null = null;
      if (dueDate && dueTime) {
        const [hours, minutes] = dueTime.split(':').map(Number);
        const combinedDate = new Date(dueDate);
        combinedDate.setHours(hours, minutes, 0, 0);
        dueAtISO = combinedDate.toISOString();
      }

      const response = await fetch(`/api/admin/places/${placeId}/improvement-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity,
          title: title.trim(),
          description: description.trim(),
          dueAt: dueAtISO,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create improvement request");
      }

      toast.success("Запрос на доработку создан");
      
      // Reset form
      setTitle("");
      setDescription("");
      setDueDate(null);
      setDueTime(null);
      setSeverity("MEDIUM");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Create improvement request error:", error);
      toast.error(error.message || "Не удалось создать запрос");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="w-full sm:w-1/2 lg:w-[30%]">
        <Label htmlFor="severity">Критичность *</Label>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger 
            id="severity" 
            className="w-full justify-between text-left"
            style={{ height: '80px', backgroundColor: 'white' }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {SEVERITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="title">Заголовок *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Краткое описание проблемы"
          maxLength={200}
        />
      </div>

      <div>
        <Label htmlFor="description">Описание *</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Подробное описание требуемых изменений. Для ссылки на фото используйте: Фото №1, Фото №2"
          rows={6}
        />
        <p className="text-xs text-gray-500 mt-1">
          Для ссылки на фото используйте: Фото №1, Фото №2, и т.д.
        </p>
      </div>

      <div>
        <Label htmlFor="dueAt">Срок выполнения (опционально)</Label>
        <DateTimePicker
          value={dueDate}
          time={dueTime}
          onDateChange={setDueDate}
          onTimeChange={setDueTime}
          labels={{
            time: "Время дедлайна",
            placeholder: "Выберите время"
          }}
        />
      </div>

      <Button type="submit" disabled={isSubmitting || !title.trim() || !description.trim()}>
        {isSubmitting ? "Создание..." : "Создать запрос"}
      </Button>
    </form>
  );
}
