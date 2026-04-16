// Step 5: Pricing
// Inherits Event Wizard Step5PricingParticipation pattern

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { StableCardSelector } from "@/components/ui/stable-card-selector";
import type { OfferFormData, PricingOption } from "../types";
import { formatPrice } from "@/lib/formatters/format-price";

interface Step5PricingProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step5Pricing({ data, onChange, isEditable }: Step5PricingProps) {
  const handlePricingModeChange = (pricingMode: "single" | "multiple") => {
    onChange({ 
      pricingMode,
      // Reset pricing data when changing mode
      singlePrice: "",
      singlePriceLabel: "",
      pricingOptions: [],
    });
  };

  const handleSinglePriceChange = (field: string, value: string) => {
    onChange({ [field]: value });
  };

  const handleAddPricingOption = () => {
    const newOption: PricingOption = {
      id: Date.now().toString(),
      title: "",
      price: "",
      oldPrice: "",
      description: "",
    };
    
    onChange({
      pricingOptions: [...data.pricingOptions, newOption],
    });
  };

  const handleUpdatePricingOption = (id: string, updates: Partial<PricingOption>) => {
    const updatedOptions = data.pricingOptions.map(option =>
      option.id === id ? { ...option, ...updates } : option
    );
    onChange({ pricingOptions: updatedOptions });
  };

  const handleRemovePricingOption = (id: string) => {
    const filteredOptions = data.pricingOptions.filter(option => option.id !== id);
    onChange({ pricingOptions: filteredOptions });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Ценообразование</h2>
        <p className="text-muted-foreground">
          Укажите стоимость предложения
        </p>
      </div>

      {/* Pricing Mode Selection */}
      <div className="space-y-3">
        <Label>Режим ценообразования</Label>
        <StableCardSelector
          value={data.pricingMode}
          onValueChange={handlePricingModeChange}
          options={[
            {
              value: "single" as const,
              label: "Одна цена",
              description: "Фиксированная стоимость",
            },
            {
              value: "multiple" as const,
              label: "Несколько вариантов",
              description: "Разные пакеты услуг",
            },
          ]}
          isEditable={isEditable}
          className="grid grid-cols-2 gap-4"
        />
      </div>

      {/* Single Price Mode */}
      {data.pricingMode === "single" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="singlePrice">
                Цена <span className="text-red-500">*</span>
              </Label>
              <Input
                id="singlePrice"
                placeholder="100"
                value={data.singlePrice}
                onChange={(e) => handleSinglePriceChange("singlePrice", e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="singleCurrency">Валюта</Label>
              <Select
                value={data.singleCurrency}
                onValueChange={(value) => handleSinglePriceChange("singleCurrency", value)}
                disabled={!isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BYN">BYN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="singlePriceLabel">Подпись к цене (необязательно)</Label>
            <Input
              id="singlePriceLabel"
              placeholder="Например: за человека, за группу"
              value={data.singlePriceLabel}
              onChange={(e) => handleSinglePriceChange("singlePriceLabel", e.target.value)}
              disabled={!isEditable}
            />
          </div>
        </div>
      )}

      {/* Multiple Pricing Mode */}
      {data.pricingMode === "multiple" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Варианты цен</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPricingOption}
              disabled={!isEditable}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить вариант
            </Button>
          </div>

          {data.pricingOptions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Добавьте хотя бы один вариант цены</p>
            </div>
          )}

          <div className="space-y-4">
            {data.pricingOptions.map((option, index) => (
              <Card key={option.id} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <h4 className="font-medium">Вариант {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePricingOption(option.id)}
                      disabled={!isEditable}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>
                        Название <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="Например: Пробное занятие"
                        value={option.title}
                        onChange={(e) => handleUpdatePricingOption(option.id, { title: e.target.value })}
                        disabled={!isEditable}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Цена <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="40"
                        value={option.price}
                        onChange={(e) => handleUpdatePricingOption(option.id, { price: e.target.value })}
                        disabled={!isEditable}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Старая цена (необязательно)</Label>
                      <Input
                        placeholder="60"
                        value={option.oldPrice || ""}
                        onChange={(e) => handleUpdatePricingOption(option.id, { oldPrice: e.target.value })}
                        disabled={!isEditable}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Textarea
                      placeholder="Что включено в этот вариант..."
                      value={option.description}
                      onChange={(e) => handleUpdatePricingOption(option.id, { description: e.target.value })}
                      disabled={!isEditable}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pricing Preview */}
      {((data.pricingMode === "single" && data.singlePrice) || 
        (data.pricingMode === "multiple" && data.pricingOptions.length > 0)) && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="font-medium mb-3">Превью цен</h4>
          <div className="space-y-2">
            {data.pricingMode === "single" && (
              <div className="flex items-center justify-between">
                <span>{data.singlePriceLabel || "Стоимость"}</span>
                <span className="font-medium">
                  {data.singlePrice} {data.singleCurrency}
                </span>
              </div>
            )}
            
            {data.pricingMode === "multiple" && data.pricingOptions.map((option) => {
              const oldPriceNumber = option.oldPrice !== "" && option.oldPrice != null ? Number(option.oldPrice) : null;
              const priceNumber = option.price !== "" && option.price != null ? Number(option.price) : null;
              const isValidOldPrice = oldPriceNumber !== null && !isNaN(oldPriceNumber) && oldPriceNumber > 0;
              const isValidPrice = priceNumber !== null && !isNaN(priceNumber);
              
              return (
                <div key={option.id} className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{option.title}</span>
                    {option.description && (
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {isValidOldPrice && (
                      <span className="text-xs text-muted-foreground line-through mr-2">
                        {formatPrice(oldPriceNumber)}
                      </span>
                    )}
                    {isValidPrice && <span className="font-medium">{formatPrice(priceNumber)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}