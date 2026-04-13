"use client";

import { BookOpen, Bookmark, MessageCircle } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { formatPrice } from "@/lib/formatters/format-price";
import { DepositTopUpTrigger } from "@/components/business/billing/DepositTopUpTrigger";
import { CreatePublicationQuickMenu } from "@/components/shared/CreatePublicationQuickMenu";
import type { DashboardData } from "./DashboardClient";

// ── Value cards ───────────────────────────────────────────────────────────────

const VALUE_CARDS = [
  {
    icon: BookOpen,
    title: "Публикации",
    text: "Ваш бизнес увидят пользователи",
  },
  {
    icon: Bookmark,
    title: "Сохранения",
    text: "Добавляют в план и возвращаются",
  },
  {
    icon: MessageCircle,
    title: "Обращения",
    text: "Вы получаете клиентов",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface NewBusinessDashboardProps {
  data: Pick<DashboardData, "depositBalance" | "lowBalanceThreshold" | "hrefs">;
}

export function NewBusinessDashboard({ data }: NewBusinessDashboardProps) {
  return (
    <div className="w-full space-y-5">

      {/* Hero */}
      <BusinessSurfaceCard className="px-8 py-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
          Создайте первое объявление
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-500">
          Добавьте публикацию, чтобы пользователи увидели ваш бизнес и вы начали получать обращения
        </p>
        <div className="mt-7">
          <CreatePublicationQuickMenu
            publicationMode="business"
            trigger={(onClick) => (
              <button
                type="button"
                onClick={onClick}
                className="w-full rounded-2xl bg-stone-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98] sm:w-auto"
              >
                Создать объявление
              </button>
            )}
          />
        </div>
      </BusinessSurfaceCard>

      {/* Value cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {VALUE_CARDS.map(({ icon: Icon, title, text }) => (
          <BusinessSurfaceCard key={title} className="flex flex-col gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100">
              <Icon className="h-5 w-5 text-stone-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">{title}</p>
              <p className="mt-0.5 text-sm text-stone-500">{text}</p>
            </div>
          </BusinessSurfaceCard>
        ))}
      </div>

      {/* Balance — secondary, neutral tone */}
      <BusinessSurfaceCard className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Баланс</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight text-stone-950">
            {formatPrice(data.depositBalance)}
          </p>
          <p className="mt-1 text-sm text-stone-400">
            Пополните баланс, когда будете готовы запускать продвижение
          </p>
        </div>
        <DepositTopUpTrigger
          balance={data.depositBalance}
          lowBalanceThreshold={data.lowBalanceThreshold}
          promotionHref={data.hrefs.promotion}
          variant="primary"
          label="Пополнить баланс"
          className="sm:shrink-0"
        />
      </BusinessSurfaceCard>

    </div>
  );
}
