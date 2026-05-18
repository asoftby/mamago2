"use client";

import React, { useState } from "react";
import { ExternalLink, Layers } from "lucide-react";
import { DemoSection } from "../_components/DemoSection";
import { OfferPageView } from "@/components/offers";
import { mockSummerCamp, mockRegularOffer } from "@/lib/offer/offerPageMock";

const VARIANTS = [
  {
    id: "camp",
    label: "Летний лагерь (CAMP)",
    badge: "CAMP",
    data: mockSummerCamp,
    mockUrl: "/minsk/offers/camps/summer-camp?mock=1",
    desc: "Полная структура: смены, таймер, скидки, размещение, отзывы, похожие",
  },
  {
    id: "regular",
    label: "Регулярные занятия (REGULAR)",
    badge: "REGULAR",
    data: mockRegularOffer,
    mockUrl: "/minsk/offers/courses/robotics-for-kids?mock=1",
    desc: "Расписание занятий, тарифы, таблица групп",
  },
] as const;

export function OfferPageSection() {
  const [active, setActive] = useState<"camp" | "regular">("camp");
  const variant = VARIANTS.find((v) => v.id === active)!;

  return (
    <DemoSection
      id="offer-page"
      title="Offer Page — шаблон страницы предложения"
      description="src/components/offers/OfferPageView.tsx · src/lib/offer/offerPageMock.ts"
    >
      {/* Meta row */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] font-semibold">OfferPageView</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">USED</span>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Монолитный клиентский компонент · {variant.desc}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Variant switcher */}
          <div className="flex rounded-lg border border-border/60 bg-background overflow-hidden">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActive(v.id)}
                className={[
                  "px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  active === v.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {v.badge}
              </button>
            ))}
          </div>

          <a
            href={variant.mockUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Открыть на отдельной вкладке
          </a>
        </div>
      </div>

      {/* Full render — break out of container */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 mt-2 rounded-2xl border border-border/40 bg-[#FAFAF8] overflow-hidden">
        <div className="border-b border-border/30 bg-muted/20 px-4 py-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">
            localhost:3000 · {variant.mockUrl}
          </span>
        </div>
        <OfferPageView data={variant.data} canEditOffer={false} />
      </div>
    </DemoSection>
  );
}
