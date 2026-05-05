// Step 2: Basic Information (MVP)
// Title, description, place selection

"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OfferFormDataMVP } from "../types.mvp";

interface Step2InformationMVPProps {
  data: OfferFormDataMVP;
  onChange: (updates: Partial<OfferFormDataMVP>) => void;
  isEditable: boolean;
}

interface Place {
  id: string;
  title: string;
  categorySlug?: string;
}

export function Step2InformationMVP({
  data,
  onChange,
  isEditable,
}: Step2InformationMVPProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  
  // Load places
  useEffect(() => {
    const loadPlaces = async () => {
      try {
        const response = await fetch("/api/business/places");
        if (response.ok) {
          const data = await response.json();
          setPlaces(data.places || []);
        }
      } catch (error) {
        console.error("Failed to load places:", error);
      } finally {
        setIsLoadingPlaces(false);
      }
    };
    
    loadPlaces();
  }, []);
  
  // Update selected place when placeId changes
  useEffect(() => {
    if (data.placeId && places.length > 0) {
      const place = places.find((p) => p.id === data.placeId);
      setSelectedPlace(place || null);
    }
  }, [data.placeId, places]);
  
  const handlePlaceChange = (placeId: string) => {
    onChange({ placeId });
    const place = places.find((p) => p.id === placeId);
    setSelectedPlace(place || null);
  };
  
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="flex items-center gap-1">
          Название предложения
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Например: Курс английского для детей 5-7 лет"
          disabled={!isEditable}
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          {data.title.length} / 100 символов
        </p>
      </div>
      
      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center gap-1">
          Описание
          <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Расскажите подробно о вашем предложении: что входит, как проходит, что получит ребенок..."
          disabled={!isEditable}
          rows={8}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Минимум 20 символов. Текущая длина: {data.description.length}
        </p>
      </div>
      
      {/* Place Selection */}
      <div className="space-y-2">
        <Label htmlFor="place" className="flex items-center gap-1">
          Место
          <span className="text-red-500">*</span>
        </Label>
        <Select
          value={data.placeId || undefined}
          onValueChange={handlePlaceChange}
          disabled={!isEditable || isLoadingPlaces}
        >
          <SelectTrigger id="place">
            <SelectValue placeholder="Выберите место" />
          </SelectTrigger>
          <SelectContent>
            {places.map((place) => (
              <SelectItem key={place.id} value={place.id}>
                {place.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {isLoadingPlaces && (
          <p className="text-xs text-muted-foreground">Загрузка мест...</p>
        )}
      </div>
      
      {/* Category Hint */}
      {selectedPlace && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2">
            <div className="text-blue-600 mt-0.5">ℹ️</div>
            <div className="text-sm text-blue-900">
              <strong>Категория предложения:</strong> Наследуется от места{" "}
              <span className="font-semibold">{selectedPlace.title}</span>
              {selectedPlace.categorySlug && (
                <span> ({selectedPlace.categorySlug})</span>
              )}
              . Отдельные категории для офферов не используются.
            </div>
          </div>
        </div>
      )}
      
      {/* Tips */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-medium text-sm mb-2">💡 Советы для хорошего описания:</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Опишите, что именно получит ребенок</li>
          <li>Укажите формат занятий (групповые/индивидуальные)</li>
          <li>Расскажите о преподавателях или программе</li>
          <li>Добавьте информацию о результатах</li>
        </ul>
      </div>
    </div>
  );
}
