"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, PauseCircle, PlayCircle, Wallet } from "lucide-react";
import {
  PromotionPublicationType,
  PromotionStatus,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { BusinessEmptyState } from "@/components/business/ui/BusinessEmptyState";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { getPromotionPublicationLabel } from "@/lib/promotion/shared";
import { formatPrice } from "@/lib/formatters/format-price";
import {
  pausePromotionAction,
  resumePromotionAction,
} from "@/app/business/(protected)/promotion/actions";
import { PromotionLaunchPanel } from "./PromotionLaunchPanel";

type PromotionRow = {
  id: string;
  publicationId: string;
  publicationType: PromotionPublicationType;
  publicationTitle: string;
  budget: number;
  spent: number;
  remainingBudget: number;
  status: PromotionStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  pausedAt: Date | null;
  saveToPlanCount: number;
  leadCount: number;
};

type PromotionTarget = {
  id: string;
  publicationType: PromotionPublicationType;
  title: string;
  status: string;
  isEligible: boolean;
  reason: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-BY", {
    style: "currency",
    currency: "BYN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function statusChip(status: PromotionStatus) {
  if (status === PromotionStatus.ACTIVE) {
    return <BusinessChip tone="accent">Active</BusinessChip>;
  }
  if (status === PromotionStatus.PAUSED) {
    return <BusinessChip tone="muted">Paused</BusinessChip>;
  }
  if (status === PromotionStatus.COMPLETED) {
    return <BusinessChip tone="muted">Completed</BusinessChip>;
  }
  return <BusinessChip tone="muted">Draft</BusinessChip>;
}

export function PromotionOverviewClient(props: {
  overviewHref: string;
  eventsHref: string;
  offersHref: string;
  dashboardHref: string;
  depositHref: string;
  depositBalance: number;
  totalBudget: number;
  totalSpend: number;
  totalSaveToPlan: number;
  totalLeads: number;
  activeCount: number;
  costPerSave: number | null;
  costPerLead: number | null;
  promotions: PromotionRow[];
  selectedTarget: PromotionTarget | null;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const handlePromotionStatusChange = (promotionId: string, mode: "pause" | "resume") => {
    startTransition(async () => {
      const result =
        mode === "pause"
          ? await pausePromotionAction({ promotionId })
          : await resumePromotionAction({ promotionId });

      if (!result.ok) {
        setFeedback({
          kind: "error",
          text: result.error ?? "Не удалось обновить статус продвижения.",
        });
        return;
      }

      setFeedback({
        kind: "success",
        text: result.message ?? "Статус продвижения обновлён.",
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BusinessSurfaceCard className="p-5">
          <p className="text-sm font-medium text-stone-500">Spend</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
            {formatMoney(props.totalSpend)}
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            Реально списанный promotion budget.
          </p>
        </BusinessSurfaceCard>
        <BusinessSurfaceCard className="p-5">
          <p className="text-sm font-medium text-stone-500">Saves to plan</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
            {props.totalSaveToPlan}
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            Сохранения, которые были attributed к активным promotion-запускам.
          </p>
        </BusinessSurfaceCard>
        <BusinessSurfaceCard className="p-5">
          <p className="text-sm font-medium text-stone-500">Leads / inquiries</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
            {props.totalLeads}
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            Для MVP считаем CTA-клики к покупке или обращению как lead-like действия.
          </p>
        </BusinessSurfaceCard>
        <BusinessSurfaceCard className="p-5">
          <p className="text-sm font-medium text-stone-500">Active promotions</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
            {props.activeCount}
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            Сколько публикаций сейчас реально получают promotion budget.
          </p>
        </BusinessSurfaceCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <BusinessSurfaceCard className="p-6 md:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                Запустить продвижение
              </h2>
              <p className="mt-1.5 text-sm text-stone-500">
                Получайте лиды — платите только за реальные действия пользователей
              </p>
            </div>
          </div>

          {props.selectedTarget ? (
            props.selectedTarget.isEligible ? (
              <PromotionLaunchPanel
                publicationId={props.selectedTarget.id}
                publicationType={props.selectedTarget.publicationType}
                publicationTitle={props.selectedTarget.title}
                publicationTypeLabel={getPromotionPublicationLabel(props.selectedTarget.publicationType)}
                depositBalance={props.depositBalance}
                depositHref={props.depositHref}
                dashboardHref={props.dashboardHref}
                onSuccess={() => {
                  router.replace(props.overviewHref);
                  router.refresh();
                }}
              />
            ) : (
              <div className="rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4 space-y-2">
                <p className="text-sm font-medium text-stone-700">{props.selectedTarget.title}</p>
                <p className="text-sm text-stone-500">
                  {props.selectedTarget.reason ?? "Эту публикацию пока нельзя продвигать."}
                </p>
                <Link
                  href={props.overviewHref}
                  className="inline-block text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800"
                >
                  Выбрать другую публикацию
                </Link>
              </div>
            )
          ) : (
            <BusinessEmptyState
              icon={<Megaphone className="h-7 w-7" />}
              title="Выберите публикацию для продвижения"
              description="Нажмите «Продвигать» на любом событии или предложении — форма откроется с уже выбранной публикацией."
              ctaLabel="Открыть события"
              ctaHref={props.eventsHref}
              secondaryText="Для предложений используйте кнопку «Продвигать» в разделе Offers."
            />
          )}
        </BusinessSurfaceCard>

        <BusinessSurfaceCard className="p-6 md:p-7">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-stone-100 p-3 text-stone-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                Эффективность
              </h2>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                Только backed-by-data показатели. Если сигналов пока мало, кабинет честно это показывает.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-stone-200/90 bg-stone-50/80 p-4">
              <p className="text-sm font-medium text-stone-500">Cost per save</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
                {props.costPerSave !== null ? formatMoney(props.costPerSave) : "Недостаточно данных"}
              </p>
            </div>
            <div className="rounded-[22px] border border-stone-200/90 bg-stone-50/80 p-4">
              <p className="text-sm font-medium text-stone-500">Cost per lead</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
                {props.costPerLead !== null ? formatMoney(props.costPerLead) : "Недостаточно данных"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-stone-200/90 bg-white px-4 py-4 text-sm leading-7 text-stone-600">
            Общий бюджет: <span className="font-semibold text-stone-950">{formatMoney(props.totalBudget)}</span>
          </div>
        </BusinessSurfaceCard>
      </section>

      {props.promotions.length === 0 ? (
        <BusinessEmptyState
          icon={<Megaphone className="h-7 w-7" />}
          title="Пока нет активных продвижений"
          description="Запустите promotion для события или offer, чтобы кабинет начал считать spend, saves и lead-like действия на реальных данных."
          ctaLabel="Открыть Offers"
          ctaHref={props.offersHref}
          secondaryText="Самый быстрый старт — выбрать публикацию с уже существующим спросом и запустить для неё небольшой тестовый бюджет."
        />
      ) : (
        <BusinessSurfaceCard className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                Активные и завершённые продвижения
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
                Здесь видно, какие публикации уже получают бюджет, сколько они потратили и какой реальный результат успели дать.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {props.promotions.map((promotion) => (
              <div
                key={promotion.id}
                className="flex flex-col gap-4 rounded-[24px] border border-stone-200/90 bg-stone-50/70 p-4 transition hover:border-stone-300 hover:bg-white md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <BusinessChip tone="muted" size="compact">
                      {getPromotionPublicationLabel(promotion.publicationType)}
                    </BusinessChip>
                    {statusChip(promotion.status)}
                  </div>
                  <p className="mt-2 text-base font-semibold text-stone-950 md:text-lg">
                    {promotion.publicationTitle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <BusinessChip>Бюджет: {formatMoney(promotion.budget)}</BusinessChip>
                    <BusinessChip>Потрачено: {formatMoney(promotion.spent)}</BusinessChip>
                    <BusinessChip>Осталось: {formatMoney(promotion.remainingBudget)}</BusinessChip>
                    <BusinessChip>Сохранения: {promotion.saveToPlanCount}</BusinessChip>
                    <BusinessChip>Лиды: {promotion.leadCount}</BusinessChip>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-stone-500">
                    {promotion.startedAt ? `Запущено ${formatDate(promotion.startedAt)}` : "Ещё не запущено"}
                    {promotion.endedAt ? ` · завершено ${formatDate(promotion.endedAt)}` : ""}
                    {promotion.pausedAt ? ` · на паузе с ${formatDate(promotion.pausedAt)}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
                  {promotion.status === PromotionStatus.ACTIVE ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      disabled={isPending}
                      onClick={() => handlePromotionStatusChange(promotion.id, "pause")}
                    >
                      <PauseCircle className="mr-2 h-4 w-4" />
                      Пауза
                    </Button>
                  ) : null}
                  {promotion.status === PromotionStatus.PAUSED ? (
                    <Button
                      type="button"
                      className="rounded-2xl bg-stone-900"
                      disabled={isPending}
                      onClick={() => handlePromotionStatusChange(promotion.id, "resume")}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Возобновить
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </BusinessSurfaceCard>
      )}
    </div>
  );
}
