"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getTodayStart } from "@/lib/date/getTodayStart";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";

export type ActivityFormData = {
  name: string;
  description?: string;
  cityId: string;
  coverImageUrl?: string;
  priceFrom?: number;
  currency?: string;
  ageLabel?: string;
  sessions: Date[];
};

type ActivityFormProps = {
  initialData?: Partial<ActivityFormData>;
  cities: Array<{ id: string; name: string }>;
  onSubmit: (data: ActivityFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
};

export function ActivityForm({
  initialData,
  cities,
  onSubmit,
  onCancel,
  submitLabel = "Создать",
}: ActivityFormProps) {
  const [formData, setFormData] = useState<ActivityFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    cityId: initialData?.cityId || cities[0]?.id || "",
    coverImageUrl: initialData?.coverImageUrl || "",
    priceFrom: initialData?.priceFrom,
    currency: initialData?.currency || "BYN",
    ageLabel: initialData?.ageLabel || "",
    sessions: initialData?.sessions || [],
  });

  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionTime, setNewSessionTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const minDate = getTodayStart().toISOString().split('T')[0];

  const handleAddSession = () => {
    if (!newSessionDate) return;

    const dateTime = newSessionTime
      ? new Date(`${newSessionDate}T${newSessionTime}`)
      : new Date(`${newSessionDate}T12:00:00`);

    setFormData((prev) => ({
      ...prev,
      sessions: [...prev.sessions, dateTime].sort((a, b) => a.getTime() - b.getTime()),
    }));

    setNewSessionDate("");
    setNewSessionTime("");
  };

  const handleRemoveSession = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Название обязательно");
      return;
    }

    if (!formData.cityId) {
      setError("Выберите город");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSessionDateTime = (date: Date) => {
    return date.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Название *
        </label>
        <Input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="text-base"
          placeholder="Название мероприятия"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Описание
        </label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          className="text-base"
          placeholder="Расскажите о мероприятии"
        />
      </div>

      {/* City */}
      <div>
        <label htmlFor="cityId" className="block text-sm font-medium text-gray-700 mb-2">
          Город *
        </label>
        <FilterSelect
          id="cityId"
          value={formData.cityId}
          options={cities.map((city) => ({ value: city.id, label: city.name }))}
          onChange={(v) => setFormData({ ...formData, cityId: v })}
          className="w-full"
          required
          aria-label="Город"
        />
      </div>

      {/* Cover Image URL */}
      <div>
        <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700 mb-2">
          URL обложки
        </label>
        <Input
          type="url"
          id="coverImageUrl"
          value={formData.coverImageUrl}
          onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
          className="text-base"
          placeholder="https://example.com/image.jpg"
        />
      </div>

      {/* Price */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="priceFrom" className="block text-sm font-medium text-gray-700 mb-2">
            Цена от
          </label>
          <Input
            type="number"
            id="priceFrom"
            value={formData.priceFrom ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                priceFrom: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            min="0"
            step="0.01"
            className="text-base"
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
            Валюта
          </label>
          <FilterSelect
            id="currency"
            value={formData.currency ?? "BYN"}
            options={[
              { value: "BYN", label: BYN_SYMBOL },
              { value: "USD", label: "USD" },
              { value: "EUR", label: "EUR" },
              { value: "RUB", label: "RUB" },
            ]}
            onChange={(v) => setFormData({ ...formData, currency: v })}
            className="w-full"
            aria-label="Валюта"
          />
        </div>
      </div>

      {/* Age Label */}
      <div>
        <label htmlFor="ageLabel" className="block text-sm font-medium text-gray-700 mb-2">
          Возраст
        </label>
        <Input
          type="text"
          id="ageLabel"
          value={formData.ageLabel}
          onChange={(e) => setFormData({ ...formData, ageLabel: e.target.value })}
          className="text-base"
          placeholder="Например: 6+, 3-7 лет"
        />
      </div>

      {/* Sessions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Сеансы</label>

        {/* Existing sessions */}
        {formData.sessions.length > 0 && (
          <div className="space-y-2 mb-4">
            {formData.sessions.map((session, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <span className="text-sm">{formatSessionDateTime(session)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSession(index)}
                >
                  Удалить
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new session */}
        <div className="space-y-3 p-4 border border-gray-200 rounded-md">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sessionDate" className="block text-xs text-gray-600 mb-1">
                Дата
              </label>
              <Input
                type="date"
                id="sessionDate"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
                min={minDate}
                className="text-base"
              />
            </div>
            <div>
              <label htmlFor="sessionTime" className="block text-xs text-gray-600 mb-1">
                Время
              </label>
              <Input
                type="time"
                id="sessionTime"
                value={newSessionTime}
                onChange={(e) => setNewSessionTime(e.target.value)}
                className="text-base"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSession}
            disabled={!newSessionDate}
            className="w-full"
          >
            Добавить сеанс
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <PrimaryButton type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Сохранение..." : submitLabel}
        </PrimaryButton>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}
