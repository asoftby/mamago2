"use client";

import { useMemo } from "react";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StableCardSelector } from "@/components/ui/stable-card-selector";
import { Textarea } from "@/components/ui/textarea";
import {
  PublicationAccessEditor,
  type PublicationAccess,
} from "@/features/publication-access";
import { WizardRichTextField } from "@/components/business/wizard/shared/WizardRichTextField";
import { BYN_SYMBOL, formatPrice } from "@/lib/formatters/format-price";
import { isRichTextMeaningful } from "@/lib/richtext/utils";
import { Plus, Trash2 } from "lucide-react";
import type { OfferFormData, PricingOption } from "../types";

interface Step5PricingProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

function getPublicationAccessFromOffer(data: OfferFormData): PublicationAccess {
  if (data.publicationAccess) return data.publicationAccess;

  if (data.ctaType === "перейти_на_сайт") {
    return {
      method: "external",
      externalUrl: data.ctaLink,
      instructions: data.ctaInstructions,
    };
  }

  if (data.ctaType === "записаться" || data.ctaType === "отправить_заявку") {
    return {
      method: "prebooking",
      phone: data.ctaPhone,
      externalUrl: data.ctaLink,
      instructions: data.ctaInstructions,
    };
  }

  if (data.ctaType === "купить_билет") {
    return {
      method: "external",
      externalUrl: data.ctaLink,
      instructions: data.ctaInstructions,
    };
  }

  return {
    method: "details",
    instructions: data.ctaInstructions,
  };
}

function buildOfferAccessPatch(access: PublicationAccess): Partial<OfferFormData> {
  switch (access.method) {
    case "external":
      return {
        publicationAccess: access,
        ctaType: "перейти_на_сайт",
        ctaLink: access.externalUrl ?? "",
        ctaPhone: access.phone ?? "",
        ctaInstructions: access.instructions ?? "",
      };
    case "contact":
      return {
        publicationAccess: access,
        ctaType: "отправить_заявку",
        ctaPhone: access.phone ?? "",
        ctaLink: "",
        ctaInstructions: access.instructions ?? "",
      };
    case "prebooking":
      return {
        publicationAccess: access,
        ctaType:
          access.externalUrl?.trim() && !access.phone?.trim()
            ? "отправить_заявку"
            : "записаться",
        ctaPhone: access.phone ?? "",
        ctaLink: access.externalUrl ?? "",
        ctaInstructions: access.instructions ?? "",
      };
    case "timeslots":
      return {
        publicationAccess: access,
        ctaType: "забронировать",
        ctaPhone: "",
        ctaLink: "",
        ctaInstructions: access.instructions ?? "",
      };
    case "details":
      return {
        publicationAccess: access,
        ctaType: "перейти_на_сайт",
        ctaLink: access.externalUrl ?? "",
        ctaInstructions: access.instructions ?? "",
      };
    default:
      return {
        publicationAccess: access,
      };
  }
}

export function Step5Pricing({
  data,
  onChange,
  isEditable,
}: Step5PricingProps) {
  const publicationAccess = useMemo(
    () => getPublicationAccessFromOffer(data),
    [data],
  );
  const hasPriceCaption = isRichTextMeaningful(data.priceCaption);
  const hasPromotionDetails = isRichTextMeaningful(data.promotionDetails);

  const handlePricingModeChange = (pricingMode: "single" | "multiple") => {
    onChange({
      pricingMode,
      singlePrice: "",
      priceCaption: "",
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

  const handleUpdatePricingOption = (
    id: string,
    updates: Partial<PricingOption>,
  ) => {
    const updatedOptions = data.pricingOptions.map((option) =>
      option.id === id ? { ...option, ...updates } : option,
    );
    onChange({ pricingOptions: updatedOptions });
  };

  const handleRemovePricingOption = (id: string) => {
    const filteredOptions = data.pricingOptions.filter(
      (option) => option.id !== id,
    );
    onChange({ pricingOptions: filteredOptions });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Стоимость и участие</h2>
        <p className="text-muted-foreground">
          Настройте цену, способ получения и дополнительные условия в одном шаге
        </p>
      </div>

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

      {data.pricingMode === "single" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="singlePrice">
                Цена <span className="text-red-500">*</span>
              </Label>
              <Input
                id="singlePrice"
                placeholder="100"
                value={data.singlePrice}
                onChange={(e) =>
                  handleSinglePriceChange("singlePrice", e.target.value)
                }
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="singleCurrency">Валюта</Label>
              <Select
                value={data.singleCurrency}
                onValueChange={(value) =>
                  handleSinglePriceChange("singleCurrency", value)
                }
                disabled={!isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BYN">{BYN_SYMBOL}</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        </div>
      )}

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
                        onChange={(e) =>
                          handleUpdatePricingOption(option.id, {
                            title: e.target.value,
                          })
                        }
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
                        onChange={(e) =>
                          handleUpdatePricingOption(option.id, {
                            price: e.target.value,
                          })
                        }
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
                        onChange={(e) =>
                          handleUpdatePricingOption(option.id, {
                            oldPrice: e.target.value,
                          })
                        }
                        disabled={!isEditable}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Textarea
                      placeholder="Что включено в этот вариант..."
                      value={option.description}
                      onChange={(e) =>
                        handleUpdatePricingOption(option.id, {
                          description: e.target.value,
                        })
                      }
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

      <div className="space-y-6">
        <WizardRichTextField
          label="Подпись к цене"
          helperText="Например: что входит в стоимость, условия участия, важные ограничения"
          value={data.priceCaption}
          onChange={(html) => onChange({ priceCaption: html })}
          placeholder="Что входит в стоимость, питание, материалы, дополнительные расходы…"
          disabled={!isEditable}
          minHeight={140}
        />

        <WizardRichTextField
          label="Акционные данные"
          helperText="Например: скидки, акции, бонусы, специальные условия"
          value={data.promotionDetails}
          onChange={(html) => onChange({ promotionDetails: html })}
          placeholder="Скидки, раннее бронирование, акции, бонусы…"
          disabled={!isEditable}
          minHeight={140}
        />
      </div>

      {((data.pricingMode === "single" && data.singlePrice) ||
        (data.pricingMode === "multiple" && data.pricingOptions.length > 0)) && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="font-medium mb-3">Превью цен</h4>
          <div className="space-y-2">
            {data.pricingMode === "single" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span>Стоимость</span>
                  <span className="font-medium">
                    {data.singlePrice} {data.singleCurrency}
                  </span>
                </div>
                {hasPriceCaption ? (
                  <div className="rounded-md border bg-background p-3">
                    <RichContentRenderer html={data.priceCaption} className="prose-p:my-2 prose-ul:my-2 prose-ol:my-2" />
                  </div>
                ) : null}
                {hasPromotionDetails ? (
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-sm font-medium mb-2">Акционные данные</div>
                    <RichContentRenderer html={data.promotionDetails} className="prose-p:my-2 prose-ul:my-2 prose-ol:my-2" />
                  </div>
                ) : null}
              </div>
            )}

            {data.pricingMode === "multiple" &&
              data.pricingOptions.map((option) => {
                const oldPriceNumber =
                  option.oldPrice !== "" && option.oldPrice != null
                    ? Number(option.oldPrice)
                    : null;
                const priceNumber =
                  option.price !== "" && option.price != null
                    ? Number(option.price)
                    : null;
                const isValidOldPrice =
                  oldPriceNumber !== null &&
                  !Number.isNaN(oldPriceNumber) &&
                  oldPriceNumber > 0;
                const isValidPrice =
                  priceNumber !== null && !Number.isNaN(priceNumber);

                return (
                  <div
                    key={option.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{option.title || "Без названия"}</div>
                      {option.description ? (
                        <div className="text-sm text-muted-foreground">
                          {option.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      {isValidOldPrice ? (
                        <div className="text-sm line-through text-muted-foreground">
                          {formatPrice(oldPriceNumber)}
                        </div>
                      ) : null}
                      <div className="font-medium">
                        {isValidPrice ? formatPrice(priceNumber) : option.price}
                      </div>
                    </div>
                  </div>
                );
              })}

            {data.pricingMode === "multiple" && (hasPriceCaption || hasPromotionDetails) ? (
              <div className="space-y-3 border-t pt-3">
                {hasPriceCaption ? (
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-sm font-medium mb-2">Подпись к цене</div>
                    <RichContentRenderer html={data.priceCaption} className="prose-p:my-2 prose-ul:my-2 prose-ol:my-2" />
                  </div>
                ) : null}
                {hasPromotionDetails ? (
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-sm font-medium mb-2">Акционные данные</div>
                    <RichContentRenderer html={data.promotionDetails} className="prose-p:my-2 prose-ul:my-2 prose-ol:my-2" />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <PublicationAccessEditor
        entityType="offer"
        value={publicationAccess}
        onChange={(value) => onChange(buildOfferAccessPatch(value))}
        allowedMethods={["details", "timeslots", "prebooking", "external", "contact"]}
        disabled={!isEditable}
      />
    </div>
  );
}
