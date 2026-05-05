"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { formatPrice } from "@/lib/formatters/format-price";
import { DepositTopUpTrigger } from "@/components/business/billing/DepositTopUpTrigger";
import { CreatePublicationQuickMenu } from "@/components/shared/CreatePublicationQuickMenu";
import type { DashboardData } from "./DashboardClient";

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "1",
    title: "Создайте объявление",
    text: "Добавьте публикацию о вашем месте, услуге или событии",
  },
  {
    num: "2",
    title: "Пополните баланс",
    text: "Баланс нужен для продвижения и платных действий внутри сервиса",
  },
  {
    num: "3",
    title: "Запустите продвижение",
    text: "Когда публикация будет готова, вы сможете увеличить охват и получать больше обращений",
  },
];

const PREVIEW_CARDS = [
  {
    icon: "📄",
    title: "Публикации",
    text: "Управляйте своими объявлениями в одном месте",
  },
  {
    icon: "💬",
    title: "Лиды и обращения",
    text: "Отслеживайте интерес пользователей к вашему бизнесу",
  },
  {
    icon: "📊",
    title: "Статистика",
    text: "Смотрите просмотры, переходы и эффективность продвижения",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface DashboardOnboardingProps {
  data: DashboardData;
}

export function DashboardOnboarding({ data }: DashboardOnboardingProps) {
  const hasInbox = data.inboxPreview.length > 0;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">

      {/* ── LEFT: onboarding content ──────────────────────────────────── */}
      <div className="min-w-0 flex-1 space-y-5">

        {/* Hero block */}
        <BusinessSurfaceCard className="p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">
            С чего начать
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
            Создайте первое объявление
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-500">
            Добавьте первую публикацию, чтобы пользователи увидели ваш бизнес, а вы начали получать просмотры, сохранения и обращения.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <CreatePublicationQuickMenu
              publicationMode="business"
              trigger={(onClick) => (
                <button
                  type="button"
                  onClick={onClick}
                  className="rounded-2xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98]"
                >
                  Создать объявление
                </button>
              )}
            />
            <Link
              href={data.hrefs.promotion}
              className="rounded-2xl border border-stone-200 bg-white px-6 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Как это работает
            </Link>
          </div>
        </BusinessSurfaceCard>

        {/* Steps */}
        <BusinessSurfaceCard className="p-6">
          <p className="mb-5 text-sm font-semibold text-stone-800">Три шага для старта</p>
          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.num} className="flex items-start gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                  {step.num}
                </span>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{step.title}</p>
                  <p className="mt-0.5 text-sm text-stone-500">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </BusinessSurfaceCard>

        {/* What's coming */}
        <div className="grid gap-3 sm:grid-cols-3">
          {PREVIEW_CARDS.map((card) => (
            <BusinessSurfaceCard key={card.title} className="p-5">
              <span className="text-xl">{card.icon}</span>
              <p className="mt-3 text-sm font-semibold text-stone-800">{card.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">{card.text}</p>
            </BusinessSurfaceCard>
          ))}
        </div>

        {/* Inbox — only if there are real messages */}
        {hasInbox && (
          <BusinessSurfaceCard className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-800">Что нового в mamaGo</p>
              <Link href={data.hrefs.bookings} className="text-xs text-stone-400 hover:text-stone-600 transition">
                Все входящие →
              </Link>
            </div>
            <div className="space-y-3">
              {data.inboxPreview.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-base leading-none">
                    {item.type === "NEWS" ? "📰" : "📣"}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("text-sm leading-snug text-stone-800 line-clamp-1", !item.seenAt && "font-semibold")}>
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ru })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </BusinessSurfaceCard>
        )}
      </div>

      {/* ── RIGHT: balance + create action ───────────────────────────── */}
      <div className="hidden lg:block w-[300px] shrink-0 border-l border-stone-200/70 pl-6">
        <div className="sticky top-6 space-y-3">
          {/* Balance — neutral tone for onboarding */}
          <BusinessSurfaceCard className="flex flex-col gap-4 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Баланс</p>
            <div>
              <p className="text-4xl font-semibold tracking-tight text-stone-950">
                {formatPrice(data.depositBalance)}
              </p>
              <p className="mt-2 text-sm text-stone-400">
                Пополните баланс, когда будете готовы запускать продвижение
              </p>
            </div>
            <DepositTopUpTrigger
              balance={data.depositBalance}
              lowBalanceThreshold={data.lowBalanceThreshold}
              promotionHref={data.hrefs.promotion}
              variant="primary"
              label="Пополнить баланс"
              className="w-full justify-center"
            />
          </BusinessSurfaceCard>

          {/* Create CTA */}
          <CreatePublicationQuickMenu
            publicationMode="business"
            trigger={(onClick) => (
              <button
                type="button"
                onClick={onClick}
                className="w-full rounded-2xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98]"
              >
                Создать объявление
              </button>
            )}
          />
        </div>
      </div>

      {/* Mobile: balance below content */}
      <div className="lg:hidden space-y-3">
        <BusinessSurfaceCard className="flex flex-col gap-4 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Баланс</p>
          <div>
            <p className="text-4xl font-semibold tracking-tight text-stone-950">
              {formatPrice(data.depositBalance)}
            </p>
            <p className="mt-2 text-sm text-stone-400">
              Пополните баланс, когда будете готовы запускать продвижение
            </p>
          </div>
          <DepositTopUpTrigger
            balance={data.depositBalance}
            lowBalanceThreshold={data.lowBalanceThreshold}
            promotionHref={data.hrefs.promotion}
            variant="primary"
            label="Пополнить баланс"
            className="w-full justify-center"
          />
        </BusinessSurfaceCard>
      </div>

    </div>
  );
}
