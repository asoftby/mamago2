"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { formatPrice } from "@/lib/formatters/format-price";
import { DepositTopUpTrigger } from "@/components/business/billing/DepositTopUpTrigger";
import { DashboardHeader } from "@/components/business/dashboard/DashboardHeader";
import { DashboardActionStack } from "@/components/business/dashboard/DashboardActionStack";
import { DashboardPeriodSwitcher } from "@/components/business/dashboard/DashboardPeriodSwitcher";
import { DashboardOnboarding } from "@/components/business/dashboard/DashboardOnboarding";
import { NewBusinessDashboard } from "@/components/business/dashboard/NewBusinessDashboard";
import type { DashboardPeriod } from "@/server/services/business/businessWorkspace.service";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DashboardData = {
  // Business identity
  businessName: string;
  legalName?: string | null;
  city?: string | null;
  // Balance
  depositBalance: number;
  periodSpend: number;
  lowBalanceThreshold: number;
  // Leads
  periodLeadCount: number;
  totalCtaClicks: number;
  // Publications
  activePromotionCount: number;
  totalPublications: number;
  pausedPromotionCount: number;
  // Inbox preview
  inboxPreview: Array<{
    id: string;
    title: string;
    type: string;
    createdAt: string;
    seenAt: string | null;
  }>;
  // Next actions
  nextActions: Array<{ label: string; href: string; cta: string }>;
  // Publications table
  topPublications: Array<{
    id: string;
    title: string;
    type: "event" | "offer";
    metrics: { views: number; saves: number; planAdds: number; ctaClicks: number };
    status: string;
  }>;
  // hrefs
  hrefs: {
    deposit: string;
    leads: string;
    publications: string;
    promotion: string;
    bookings: string;
    newPublication: string;
    settings: string;
  };
};

// ── Balance Panel (sticky right) ──────────────────────────────────────────────

function BalancePanel({
  balance,
  periodSpend,
  lowBalanceThreshold,
  depositHref,
  promotionHref,
}: {
  balance: number;
  periodSpend: number;
  lowBalanceThreshold: number;
  depositHref: string;
  promotionHref: string;
}) {
  const isEmpty = balance <= 0;
  const isLow = !isEmpty && balance < lowBalanceThreshold;

  return (
    <BusinessSurfaceCard
      tone="default"
      className="flex flex-col gap-5 p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Баланс</p>

      {/* Balance amount */}
      <div>
        <p
          className={cn(
            "text-4xl font-semibold tracking-tight",
            isEmpty ? "text-primary" : "text-stone-950",
          )}
        >
          {formatPrice(balance)}
        </p>

        {isEmpty ? (
          <p className="mt-2 text-sm text-primary">
            Недостаточно средств для продвижения
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-500">
            Потрачено за период:{" "}
            <span className="font-medium text-stone-700">{formatPrice(periodSpend)}</span>
          </p>
        )}
      </div>

      {/* Low balance warning */}
      {isLow && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          ⚠️ Баланс заканчивается
        </div>
      )}

      {/* CTA */}
      <DepositTopUpTrigger
        balance={balance}
        lowBalanceThreshold={lowBalanceThreshold}
        promotionHref={promotionHref}
        variant={isEmpty || isLow ? "warning" : "primary"}
        label="Пополнить баланс"
        className="w-full justify-center"
      />
    </BusinessSurfaceCard>
  );
}

// ── KPI Card: Leads ───────────────────────────────────────────────────────────

function LeadsCard({
  leadCount,
  ctaClicks,
  leadsHref,
  publicationsHref,
}: {
  leadCount: number;
  ctaClicks: number;
  leadsHref: string;
  publicationsHref: string;
}) {
  const isEmpty = leadCount === 0 && ctaClicks === 0;

  return (
    <BusinessSurfaceCard tone={isEmpty ? "default" : "success"} className="flex flex-col gap-4 p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Лиды и обращения</p>

      {isEmpty ? (
        <div>
          <p className="text-2xl font-semibold text-stone-400">Пока нет лидов</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Добавьте CTA или запустите продвижение, чтобы начать получать обращения
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-stone-950">{leadCount}</span>
            <span className="text-sm text-stone-500">лидов</span>
          </div>
          {ctaClicks > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-stone-700">{ctaClicks}</span>
              <span className="text-sm text-stone-500">переходов по CTA</span>
            </div>
          )}
        </div>
      )}

      <Link
        href={isEmpty ? publicationsHref : leadsHref}
        className="mt-auto inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:border-stone-300 self-start"
      >
        {isEmpty ? "Настроить публикации" : "Открыть заявки"}
      </Link>
    </BusinessSurfaceCard>
  );
}

// ── KPI Card: Publications ────────────────────────────────────────────────────

function PublicationsCard({
  activePromotions,
  totalPublications,
  paused,
  promotionHref,
  newPublicationHref,
}: {
  activePromotions: number;
  totalPublications: number;
  paused: number;
  promotionHref: string;
  newPublicationHref: string;
}) {
  const noPublications = totalPublications === 0;
  const noPromotion = totalPublications > 0 && activePromotions === 0;

  return (
    <BusinessSurfaceCard className="flex flex-col gap-4 p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Публикации и продвижение</p>

      {noPublications ? (
        <div>
          <p className="text-2xl font-semibold text-stone-400">Нет публикаций</p>
          <p className="mt-2 text-sm text-stone-500">Создайте первую публикацию, чтобы начать получать спрос</p>
        </div>
      ) : noPromotion ? (
        <div>
          <p className="text-3xl font-semibold tracking-tight text-stone-950">{totalPublications}</p>
          <p className="mt-1.5 text-sm text-stone-500">
            публикаций ·{" "}
            <span className="text-primary font-medium">0 активных продвижений</span>
          </p>
          <p className="mt-1 text-sm text-stone-500">Запустите продвижение, чтобы получать лиды</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-stone-950">{activePromotions}</span>
            <span className="text-sm text-stone-500">активных продвижений</span>
          </div>
          <p className="text-sm text-stone-500">
            Всего публикаций:{" "}
            <span className="font-medium text-stone-700">{totalPublications}</span>
            {paused > 0 && <span className="ml-2 text-stone-400">· {paused} на паузе</span>}
          </p>
        </div>
      )}

      <Link
        href={noPublications ? newPublicationHref : promotionHref}
        className="mt-auto inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:border-stone-300 self-start"
      >
        {noPublications
          ? "Создать публикацию"
          : noPromotion
            ? "Запустить продвижение"
            : "Управлять продвижением"}
      </Link>
    </BusinessSurfaceCard>
  );
}

// ── Secondary: Inbox preview ──────────────────────────────────────────────────

function InboxPreviewBlock({
  items,
  bookingsHref,
}: {
  items: DashboardData["inboxPreview"];
  bookingsHref: string;
}) {
  return (
    <BusinessSurfaceCard className="flex flex-col gap-4 p-6 min-h-[196px]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">Что нового в mamaGo</p>
        <Link
        href={bookingsHref}
        className="text-xs text-stone-400 hover:text-stone-600 transition"
      >
        Все входящие →
      </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-stone-400">Нет новых сообщений</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-base leading-none">
                {item.type === "NEWS" ? "📰" : "📣"}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm leading-snug text-stone-800 line-clamp-1",
                    !item.seenAt && "font-semibold",
                  )}
                >
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-stone-400">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ru })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

    </BusinessSurfaceCard>
  );
}

// ── Secondary: Next actions ───────────────────────────────────────────────────

function NextActionsBlock({ actions }: { actions: DashboardData["nextActions"] }) {
  return (
    <BusinessSurfaceCard className="flex flex-col gap-4 p-6">
      <p className="text-sm font-semibold text-stone-800">Что сделать дальше</p>

      <div className="space-y-3">
        {actions.map((action, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3"
          >
            <p className="text-sm text-stone-700 leading-snug">{action.label}</p>
            <Link
              href={action.href}
              className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100 whitespace-nowrap"
            >
              {action.cta}
            </Link>
          </div>
        ))}
      </div>
    </BusinessSurfaceCard>
  );
}

// ── Publications table ────────────────────────────────────────────────────────

function PublicationsSection({
  items,
  publicationsHref,
}: {
  items: DashboardData["topPublications"];
  publicationsHref: string;
}) {
  return (
    <BusinessSurfaceCard className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">Публикации за период</p>
        <Link href={publicationsHref} className="text-xs text-stone-400 hover:text-stone-600 transition">
          Все публикации →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm font-medium text-stone-500">Пока нет данных</p>
          <p className="max-w-xs text-sm text-stone-400">
            Когда появятся просмотры и лиды, здесь будет видно эффективность публикаций
          </p>
          <Link
            href={publicationsHref}
            className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
          >
            Открыть публикации
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="pb-3 text-left text-xs font-medium text-stone-400">Название</th>
                <th className="pb-3 text-right text-xs font-medium text-stone-400">Просмотры</th>
                <th className="pb-3 text-right text-xs font-medium text-stone-400">Лиды</th>
                <th className="pb-3 text-right text-xs font-medium text-stone-400">Сохранения</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {items.map((pub) => (
                <tr key={pub.id} className="group">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-stone-800 line-clamp-1 group-hover:text-stone-950">
                      {pub.title}
                    </p>
                    <p className="text-xs text-stone-400 capitalize">
                      {pub.type === "event" ? "Событие" : "Предложение"}
                    </p>
                  </td>
                  <td className="py-3 text-right tabular-nums text-stone-600">{pub.metrics.views}</td>
                  <td className="py-3 text-right tabular-nums font-medium text-stone-800">
                    {pub.metrics.ctaClicks}
                  </td>
                  <td className="py-3 text-right tabular-nums text-stone-600">
                    {pub.metrics.saves + pub.metrics.planAdds}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BusinessSurfaceCard>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

interface DashboardClientProps {
  data: DashboardData;
  defaultPeriod?: DashboardPeriod;
}

export function DashboardClient({ data, defaultPeriod = "week" }: DashboardClientProps) {
  const [period, setPeriod] = useState<DashboardPeriod>(defaultPeriod);

  // No publications → onboarding screen
  const isOnboarding = data.totalPublications === 0;

  return (
    <div className="space-y-5">
      {/* Header: title + identity — always shown */}
      <DashboardHeader
        businessName={data.businessName}
        legalName={data.legalName}
        city={data.city}
        settingsHref={data.hrefs.settings}
      />

      {isOnboarding ? (
        <NewBusinessDashboard data={data} />
      ) : (
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">

        {/* ── LEFT: main content ─────────────────────────────────────────── */}
        <div className="min-w-0 flex-1 space-y-5">

          {/* Mobile-only: Balance + actions first */}
          <div className="lg:hidden space-y-3">
            <BalancePanel
              balance={data.depositBalance}
              periodSpend={data.periodSpend}
              lowBalanceThreshold={data.lowBalanceThreshold}
              depositHref={data.hrefs.deposit}
              promotionHref={data.hrefs.promotion}
            />
            <DashboardActionStack
              promotionHref={data.hrefs.promotion}
              hasPublications={data.totalPublications > 0}
            />
          </div>

          {/* Inbox — full width, above KPI cards, reduced height */}
          <InboxPreviewBlock items={data.inboxPreview} bookingsHref={data.hrefs.bookings} />

          {/* Period switcher — below inbox, above KPI cards */}
          <DashboardPeriodSwitcher value={period} onChange={setPeriod} />

          {/* KPI row — 2 cards */}
          <section className="grid gap-4 sm:grid-cols-2">
            <PublicationsCard
              activePromotions={data.activePromotionCount}
              totalPublications={data.totalPublications}
              paused={data.pausedPromotionCount}
              promotionHref={data.hrefs.promotion}
              newPublicationHref={data.hrefs.newPublication}
            />
            <LeadsCard
              leadCount={data.periodLeadCount}
              ctaClicks={data.totalCtaClicks}
              leadsHref={data.hrefs.leads}
              publicationsHref={data.hrefs.publications}
            />
          </section>

          {/* Publications performance */}
          <PublicationsSection
            items={data.topPublications}
            publicationsHref={data.hrefs.publications}
          />


        </div>

        {/* ── RIGHT: sticky Balance panel + actions (desktop only) ──────── */}
        <div className="hidden lg:block w-[300px] shrink-0 border-l border-stone-200/70 pl-6">
          <div className="sticky top-6 space-y-3">
            <BalancePanel
              balance={data.depositBalance}
              periodSpend={data.periodSpend}
              lowBalanceThreshold={data.lowBalanceThreshold}
              depositHref={data.hrefs.deposit}
              promotionHref={data.hrefs.promotion}
            />
            <DashboardActionStack
              promotionHref={data.hrefs.promotion}
              hasPublications={data.totalPublications > 0}
            />
          </div>
        </div>

      </div>
      )}
    </div>
  );
}
