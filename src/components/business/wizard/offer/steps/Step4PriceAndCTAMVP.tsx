// Step 4: Price and CTA (MVP)
// Pricing and call-to-action configuration

"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OfferFormDataMVP } from "../types.mvp";

interface Step4PriceAndCTAMVPProps {
  data: OfferFormDataMVP;
  onChange: (updates: Partial<OfferFormDataMVP>) => void;
  isEditable: boolean;
}

const CTA_OPTIONS = [
  { value: "записаться", label: "Записаться", icon: "📝", needsPhone: true },
  { value: "забронировать", label: "Забронировать", icon: "📅", needsPhone: true },
  { value: "купить_билет", label: "Купить билет", icon: "🎫", needsLink: true },
  { value: "отправить_заявку", label: "Отправить заявку", icon: "📧", needsPhone: true },
  { value: "перейти_на_сайт", label: "Перейти на сайт", icon: "🌐", needsLink: true },
] as const;

export function Step4PriceAndCTAMVP({
  data,
  onChange,
  isEditable,
}: Step4PriceAndCTAMVPProps) {
  const [showPriceText, setShowPriceText] = useState(false);
  const [placeData, setPlaceData] = useState<{
    phone?: string;
    website?: string;
  } | null>(null);
  
  // Load place data for pre-filling
  useEffect(() => {
    const loadPlaceData = async () => {
      if (!data.placeId) return;
      
      try {
        const response = await fetch(`/api/business/places/${data.placeId}`);
        if (response.ok) {
          const place = await response.json();
          setPlaceData({
            phone: place.phone,
            website: place.website,
          });
          
          // Pre-fill if empty
          if (!data.ctaPhone && place.phone) {
            onChange({ ctaPhone: place.phone });
          }
          if (!data.ctaLink && place.website) {
            onChange({ ctaLink: place.website });
          }
        }
      } catch (error) {
        console.error("Failed to load place data:", error);
      }
    };
    
    loadPlaceData();
  }, [data.placeId]);
  
  const selectedCTA = CTA_OPTIONS.find((opt) => opt.value === data.ctaType);
  const needsPhone = selectedCTA?.needsPhone || false;
  const needsLink = selectedCTA?.needsLink || false;
  
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">Цена и запись</h2>
        <p className="text-muted-foreground">
          Укажите стоимость и способ связи
        </p>
      </div>
      
      {/* Price */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="priceFrom" className="flex items-center gap-1">
            Цена от (BYN)
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="priceFrom"
            type="number"
            value={data.priceFrom || ""}
            onChange={(e) => onChange({ priceFrom: parseFloat(e.target.value) || null })}
            placeholder="Например: 50"
            disabled={!isEditable}
            min={0}
            step={0.01}
          />
          <p className="text-xs text-muted-foreground">
            Укажите минимальную стоимость в белорусских рублях
          </p>
        </div>
        
        {/* Optional Price Text (Collapsed) */}
        {!showPriceText && (
          <button
            type="button"
            onClick={() => setShowPriceText(true)}
            className="text-sm text-primary hover:underline"
          >
            + Добавить пояснение к цене (необязательно)
          </button>
        )}
        
        {showPriceText && (
          <div className="space-y-2">
            <Label htmlFor="priceText">
              Пояснение к цене
              <span className="text-muted-foreground ml-1">(необязательно)</span>
            </Label>
            <Input
              id="priceText"
              value={data.priceText}
              onChange={(e) => onChange({ priceText: e.target.value })}
              placeholder="Например: за 1 занятие, за месяц, за смену"
              disabled={!isEditable}
            />
            <button
              type="button"
              onClick={() => {
                setShowPriceText(false);
                onChange({ priceText: "" });
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Скрыть
            </button>
          </div>
        )}
      </div>
      
      {/* CTA Type */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ctaType" className="flex items-center gap-1">
            Действие для пользователя
            <span className="text-red-500">*</span>
          </Label>
          <Select
            value={data.ctaType || undefined}
            onValueChange={(value) => onChange({ ctaType: value as any })}
            disabled={!isEditable}
          >
            <SelectTrigger id="ctaType">
              <SelectValue placeholder="Выберите действие" />
            </SelectTrigger>
            <SelectContent>
              {CTA_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Что увидит пользователь на кнопке в карточке предложения
          </p>
        </div>
      </div>
      
      {/* Contact Methods */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-4">
        <h3 className="font-semibold">Контакты для связи</h3>
        
        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="ctaPhone" className={cn(
            "flex items-center gap-1",
            needsPhone && "after:content-['*'] after:text-red-500"
          )}>
            Телефон
            {!needsPhone && (
              <span className="text-muted-foreground ml-1">(необязательно)</span>
            )}
          </Label>
          <Input
            id="ctaPhone"
            type="tel"
            value={data.ctaPhone}
            onChange={(e) => onChange({ ctaPhone: e.target.value })}
            placeholder="+375 29 123-45-67"
            disabled={!isEditable}
          />
          {placeData?.phone && data.ctaPhone === placeData.phone && (
            <p className="text-xs text-green-600">
              ✓ Автоматически заполнено из профиля места
            </p>
          )}
        </div>
        
        {/* Link */}
        <div className="space-y-2">
          <Label htmlFor="ctaLink" className={cn(
            "flex items-center gap-1",
            needsLink && "after:content-['*'] after:text-red-500"
          )}>
            Ссылка
            {!needsLink && (
              <span className="text-muted-foreground ml-1">(необязательно)</span>
            )}
          </Label>
          <Input
            id="ctaLink"
            type="url"
            value={data.ctaLink}
            onChange={(e) => onChange({ ctaLink: e.target.value })}
            placeholder="https://example.com"
            disabled={!isEditable}
          />
          {placeData?.website && data.ctaLink === placeData.website && (
            <p className="text-xs text-green-600">
              ✓ Автоматически заполнено из профиля места
            </p>
          )}
        </div>
        
        {/* Validation hint */}
        {data.ctaType && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            {needsPhone && needsLink && (
              <p>Для действия <strong>{selectedCTA?.label}</strong> требуется указать телефон или ссылку</p>
            )}
            {needsPhone && !needsLink && (
              <p>Для действия <strong>{selectedCTA?.label}</strong> требуется указать телефон</p>
            )}
            {needsLink && !needsPhone && (
              <p>Для действия <strong>{selectedCTA?.label}</strong> требуется указать ссылку</p>
            )}
          </div>
        )}
      </div>
      
      {/* Tips */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-medium text-sm mb-2">💡 Советы:</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Укажите реальную цену — это повышает доверие</li>
          <li>Выберите действие, которое соответствует вашему процессу</li>
          <li>Убедитесь, что контакты актуальны и доступны</li>
        </ul>
      </div>
    </div>
  );
}
