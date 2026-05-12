"use client";

import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

interface OfferPricingProps {
  pricing: OfferPageData["pricing"];
}

/**
 * Pricing Block (Sidebar Card)
 * Shows: price, price from, multiple options, promotions
 */
export function OfferPricing({ pricing }: OfferPricingProps) {
  const hasSinglePrice = pricing.mode === "single" && pricing.singlePrice;
  const hasMultiplePrices = pricing.mode === "multiple" && pricing.options && pricing.options.length > 0;
  const hasPromotion = Boolean(pricing.promotionText);

  return (
    <div className="space-y-6 rounded-3xl border border-border/60 bg-background p-6 shadow-lg">
      {/* Promotion Banner */}
      {hasPromotion && (
        <div className="flex items-start gap-3 rounded-2xl bg-[#FFF7F3] p-4 border border-[#EF8759]/20">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EF8759]/10">
            <Tag className="h-4 w-4 text-[#EF8759]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#EF8759]">
              {pricing.promotionText}
            </p>
            {pricing.promotionSubtitle && (
              <p className="mt-1 text-[13px] text-muted-foreground">
                {pricing.promotionSubtitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Single Price */}
      {hasSinglePrice && (
        <div className="space-y-2">
          <p className="text-[14px] font-medium text-muted-foreground">Стоимость</p>
          <div className="flex items-baseline gap-2">
            <p className="text-[32px] font-bold text-foreground">
              {pricing.singlePrice}
            </p>
            {pricing.singleCurrency && (
              <p className="text-[18px] font-medium text-muted-foreground">
                {pricing.singleCurrency}
              </p>
            )}
          </div>
          {pricing.priceCaption && (
            <p className="text-[13px] text-muted-foreground">
              {pricing.priceCaption}
            </p>
          )}
        </div>
      )}

      {/* Price From */}
      {pricing.priceFrom && !hasSinglePrice && (
        <div className="space-y-2">
          <p className="text-[14px] font-medium text-muted-foreground">Стоимость</p>
          <div className="flex items-baseline gap-2">
            <p className="text-[16px] text-muted-foreground">от</p>
            <p className="text-[32px] font-bold text-foreground">
              {pricing.priceFrom}
            </p>
          </div>
          {pricing.priceCaption && (
            <p className="text-[13px] text-muted-foreground">
              {pricing.priceCaption}
            </p>
          )}
        </div>
      )}

      {/* Multiple Pricing Options */}
      {hasMultiplePrices && (
        <div className="space-y-3">
          <p className="text-[14px] font-medium text-muted-foreground">Варианты цен</p>
          <div className="space-y-2">
            {pricing.options!.map((option) => (
              <div
                key={option.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background p-3 hover:border-border transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-foreground">
                    {option.title}
                  </p>
                  {option.description && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {option.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {option.oldPrice && (
                    <p className="text-[12px] text-muted-foreground line-through">
                      {option.oldPrice}
                    </p>
                  )}
                  <p className="text-[16px] font-bold text-foreground">
                    {option.price}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
