"use client";

import { CalendarDays, FileText, CheckCircle2, PartyPopper, ArrowRight } from "lucide-react";
import type { OfferCtaType } from "@/lib/offer/offerPageTypes";

interface OfferHowToJoinProps {
  ctaType: OfferCtaType;
}

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function getSteps(ctaType: OfferCtaType): Step[] {
  const base: Step[] = [
    {
      id: "select",
      icon: <CalendarDays className="h-6 w-6" />,
      title: "Выберите группу",
      description: "Подберите удобное расписание и группу",
    },
    {
      id: "apply",
      icon: <FileText className="h-6 w-6" />,
      title: "Оставьте заявку",
      description: "Заполните форму или позвоните нам",
    },
    {
      id: "confirm",
      icon: <CheckCircle2 className="h-6 w-6" />,
      title: "Подтверждение",
      description: "Мы свяжемся с вами и подтвердим запись",
    },
    {
      id: "welcome",
      icon: <PartyPopper className="h-6 w-6" />,
      title: "Добро пожаловать!",
      description: "Приходите на занятие и погружайтесь в обучение",
    },
  ];

  if (ctaType === "забронировать") {
    return [
      { ...base[0]!, title: "Выберите дату", description: "Подберите удобное время" },
      { ...base[1]!, title: "Забронируйте", description: "Оставьте контакты для брони" },
      { ...base[2]!, description: "Получите подтверждение брони" },
      { ...base[3]!, title: "Готово!", description: "Ждём вас в назначенное время" },
    ];
  }

  if (ctaType === "купить_билет") {
    return [
      { ...base[0]!, title: "Выберите билет", description: "Подберите подходящий вариант" },
      { ...base[1]!, title: "Оформите заказ", description: "Заполните данные для покупки" },
      { ...base[2]!, title: "Оплатите", description: "Завершите оплату билета" },
      { ...base[3]!, title: "Билет готов!", description: "Получите билет на email" },
    ];
  }

  return base;
}

function getTitle(ctaType: OfferCtaType): string {
  const map: Record<OfferCtaType, string> = {
    записаться: "Как записаться",
    забронировать: "Как записаться",
    купить_билет: "Как купить билет",
    отправить_заявку: "Как оставить заявку",
    перейти_на_сайт: "Как принять участие",
  };
  return map[ctaType] ?? "Как записаться";
}

/**
 * How to Join — 4 шага
 * Desktop: горизонтальный ряд со стрелками
 * Mobile: вертикальный список
 */
export function OfferHowToJoin({ ctaType }: OfferHowToJoinProps) {
  const steps = getSteps(ctaType);

  return (
    <section className="space-y-6">
      <h2 className="text-[22px] font-bold text-gray-900 lg:text-[24px]">
        {getTitle(ctaType)}
      </h2>

      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start gap-0">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex flex-1 items-start gap-0">
            {/* Step */}
            <div className="flex flex-1 flex-col items-center text-center px-3">
              {/* Icon */}
              <div className="relative mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF7F3] text-[#EF8759]">
                  {step.icon}
                </div>
                {/* Number badge */}
                <div className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#EF8759] text-[11px] font-bold text-white shadow-sm">
                  {idx + 1}
                </div>
              </div>
              <h3 className="text-[14px] font-bold text-gray-900 leading-tight">{step.title}</h3>
              <p className="mt-1.5 text-[12px] text-gray-500 leading-relaxed max-w-[140px]">
                {step.description}
              </p>
            </div>

            {/* Arrow connector */}
            {idx < steps.length - 1 && (
              <div className="flex items-center pt-7 shrink-0 text-gray-200">
                <ArrowRight className="h-5 w-5" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="flex flex-col gap-4 sm:hidden">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-start gap-4">
            {/* Icon + line */}
            <div className="flex flex-col items-center">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF7F3] text-[#EF8759]">
                {step.icon}
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF8759] text-[10px] font-bold text-white">
                  {idx + 1}
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className="mt-2 h-8 w-px bg-gray-100" />
              )}
            </div>
            {/* Text */}
            <div className="pt-1 pb-4">
              <h3 className="text-[14px] font-bold text-gray-900">{step.title}</h3>
              <p className="mt-0.5 text-[13px] text-gray-500">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
