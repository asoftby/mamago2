"use client";

import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Phone,
  Plus,
  Printer,
  Send,
  Share2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  AlternativePerformer,
  PerformerStatus,
  ScenarioTimelineItem,
  UserBirthdayPartyDetail,
} from "@/features/me/types/userBirthdayParty";
import { cn } from "@/lib/utils";

type ScenarioFinalPageProps = {
  party: UserBirthdayPartyDetail;
  title: string;
  dateTimeLine: string | null;
  onBack?: () => void;
  onClose?: () => void;
};

function formatShortDate(dateIso: string | null): string | null {
  if (!dateIso) return null;
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function formatMoney(value: number | null | undefined): string | null {
  if (value == null) return null;
  return `${value} ${BYN_SYMBOL}`;
}

function getStatusTone(status: PerformerStatus) {
  switch (status) {
    case "CONFIRMED":
      return "bg-[#EAF7E1] text-[#548B2F]";
    case "DECLINED":
      return "bg-[#FFF0EC] text-[#E14D35]";
    case "PENDING":
      return "bg-[#F7F1E8] text-[#8A6A45]";
  }
}

function getStatusLabel(status: PerformerStatus) {
  switch (status) {
    case "CONFIRMED":
      return "Подтверждено";
    case "DECLINED":
      return "Исполнитель отказал";
    case "PENDING":
      return "Ожидает подтверждения";
  }
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function PerformerStatusBadge({ status }: { status: PerformerStatus }) {
  return (
    <Badge
      className={cn(
        "rounded-full border-0 px-3 py-1 text-[12px] font-medium shadow-none",
        getStatusTone(status),
      )}
    >
      {getStatusLabel(status)}
    </Badge>
  );
}

export function PerformerContactActions({
  item,
}: {
  item: ScenarioTimelineItem;
}) {
  if (item.status !== "CONFIRMED" || !item.contact) return null;

  const actions = [
    {
      label: "Позвонить",
      href: `tel:${item.contact.phone.replace(/[^\d+]/g, "")}`,
      icon: Phone,
    },
    item.contact.telegram
      ? {
          label:
            item.contact.telegram.toLowerCase().includes("telegram")
              ? "Telegram"
              : "Написать",
          href: item.contact.telegram,
          icon: item.contact.telegram.toLowerCase().includes("telegram")
            ? Send
            : MessageCircle,
        }
      : item.contact.messageHref
        ? {
            label: "Написать",
            href: item.contact.messageHref,
            icon: MessageCircle,
          }
        : null,
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    icon: typeof Phone;
  }>;

  if (actions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-[rgba(20,18,16,0.10)] bg-white px-4 text-[14px] text-[#141210] shadow-none hover:bg-[#FAF7F1]"
            asChild
          >
            <a href={action.href} target="_blank" rel="noopener noreferrer">
              <Icon className="h-4 w-4" />
              {action.label}
            </a>
          </Button>
        );
      })}
    </div>
  );
}

export function AlternativePerformerCard({
  alternative,
}: {
  alternative: AlternativePerformer;
}) {
  return (
    <article className="rounded-[18px] border border-[rgba(20,18,16,0.08)] bg-white p-3 shadow-[0_1px_3px_rgba(20,18,16,0.04)]">
      <div className="relative mb-3 h-24 overflow-hidden rounded-[16px] border border-[rgba(20,18,16,0.05)] bg-[linear-gradient(135deg,rgba(248,239,222,0.95),rgba(244,235,217,0.9))]">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_12px,transparent_12px,transparent_24px)]" />
        {alternative.rating ? (
          <div className="absolute right-2 top-2 rounded-full bg-[#2A2724] px-2 py-1 text-[11px] font-medium text-white">
            ★ {alternative.rating.toFixed(1)}
          </div>
        ) : null}
        <button
          type="button"
          className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#141210] shadow-[0_6px_14px_rgba(20,18,16,0.12)]"
          aria-label={`Добавить ${alternative.title}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#EF8759]">
          {alternative.category}
        </p>
        <h4 className="min-h-[44px] text-[15px] font-semibold leading-snug text-[#141210]">
          {alternative.title}
        </h4>
        <div className="flex items-end justify-between gap-3">
          <button
            type="button"
            className="text-[12px] font-medium text-[#6F665E] underline underline-offset-2"
          >
            Подробнее
          </button>
          <div className="text-right">
            <span className="font-[var(--font-display,Georgia,serif)] text-[24px] leading-none text-[#141210]">
              {alternative.price}
            </span>
            <span className="ml-1 text-[10px] uppercase tracking-[0.08em] text-[#8A8178]">
              {BYN_SYMBOL}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function AlternativesSection({
  alternatives,
}: {
  alternatives: AlternativePerformer[];
}) {
  if (alternatives.length === 0) return null;

  return (
    <div className="mt-4 rounded-[22px] border border-[rgba(20,18,16,0.06)] bg-[#FFFDFC] p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">
        Доступные альтернативы
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {alternatives.map((alternative) => (
          <AlternativePerformerCard
            key={alternative.id}
            alternative={alternative}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-[rgba(20,18,16,0.10)] bg-white px-5 text-[14px] text-[#3B352F] shadow-none hover:bg-[#FAF7F1]"
        >
          Показать еще
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TimelineDot({ status }: { status?: PerformerStatus }) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#6CBF3A] text-white">
        <CheckCircle2 className="h-4 w-4" />
      </span>
    );
  }
  if (status === "DECLINED") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EF3D2F] text-white">
        <XCircle className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 rounded-full border border-[rgba(20,18,16,0.14)] bg-white" />
  );
}

export function ScenarioTimelineItem({
  item,
}: {
  item: ScenarioTimelineItem;
}) {
  return (
    <div className="grid grid-cols-[74px_22px_minmax(0,1fr)] gap-3 sm:grid-cols-[92px_24px_minmax(0,1fr)]">
      <div className="pt-3 text-right text-[15px] font-semibold tabular-nums leading-tight text-[#2B2825]">
        {item.time}
      </div>
      <div className="relative flex justify-center pt-3">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[rgba(20,18,16,0.12)]" />
        <div className="relative z-10">
          <TimelineDot status={item.status} />
        </div>
      </div>
      <article className="rounded-[22px] border border-[rgba(20,18,16,0.08)] bg-white p-4 shadow-[0_1px_3px_rgba(20,18,16,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold leading-tight text-[#141210]">
              {item.title}
            </h3>
            {item.subtitle ? (
              <p className="mt-1 text-[15px] text-[#4F4740]">{item.subtitle}</p>
            ) : null}
            {item.description ? (
              <p className="mt-1 text-[14px] text-[#7E756C]">{item.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-3 sm:items-center">
            {item.status ? <PerformerStatusBadge status={item.status} /> : null}
            {item.price != null ? (
              <div className="whitespace-nowrap text-right">
                <span className="font-[var(--font-display,Georgia,serif)] text-[30px] leading-none text-[#141210]">
                  {item.price}
                </span>
                <span className="ml-1 text-[10px] uppercase tracking-[0.08em] text-[#8A8178]">
                  {BYN_SYMBOL}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {item.status === "CONFIRMED" && item.contact ? (
          <p className="mt-3 text-[14px] text-[#6E665F]">
            {item.contactLabel ?? "Контакт"}: {item.contact.name}{" "}
            <span className="mx-2 text-[#D8CCC1]">•</span>
            {item.contact.phone}
          </p>
        ) : null}

        <PerformerContactActions item={item} />
        {item.status === "DECLINED" && item.alternatives?.length ? (
          <AlternativesSection alternatives={item.alternatives} />
        ) : null}
      </article>
    </div>
  );
}

export function ScenarioTimeline({
  items,
  totalPrice,
}: {
  items: ScenarioTimelineItem[];
  totalPrice?: number | null;
}) {
  return (
    <section className="rounded-[28px] border border-[rgba(20,18,16,0.08)] bg-[#FFFDFC] p-4 sm:p-5">
      <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">
        Сценарий по времени
      </p>
      <div className="space-y-4">
        {items.map((item) => (
          <ScenarioTimelineItem key={item.id} item={item} />
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-[rgba(20,18,16,0.08)] pt-4">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">
          Итого
        </span>
        <div>
          <span className="font-[var(--font-display,Georgia,serif)] text-[34px] leading-none text-[#141210]">
            {totalPrice ?? 0}
          </span>
          <span className="ml-1 text-[11px] uppercase tracking-[0.08em] text-[#8A8178]">
            {BYN_SYMBOL}
          </span>
        </div>
      </div>
    </section>
  );
}

export function ScenarioStatusSummary({
  party,
  confirmedCount,
  declinedCount,
}: {
  party: UserBirthdayPartyDetail;
  confirmedCount: number;
  declinedCount: number;
}) {
  const dateLabel = formatShortDate(party.dateIso);

  return (
    <section className="rounded-[28px] border border-[rgba(20,18,16,0.08)] bg-[#FFFDFC] p-4 sm:p-5">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">
        Статус сценария
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge className="rounded-full border border-[rgba(20,18,16,0.08)] bg-white px-3 py-1.5 text-[13px] font-medium text-[#423B35]">
          {party.childName}
          {party.childAgeLabel ? (
            <>
              <span className="mx-1.5 text-[#D8CCC1]">•</span>
              {party.childAgeLabel}
            </>
          ) : null}
        </Badge>
        {party.guestsLabel ? (
          <Badge className="rounded-full border border-[rgba(20,18,16,0.08)] bg-white px-3 py-1.5 text-[13px] font-medium text-[#423B35]">
            {party.guestsLabel}
          </Badge>
        ) : null}
        {(dateLabel || party.timeStart) ? (
          <Badge className="rounded-full border border-[rgba(20,18,16,0.08)] bg-white px-3 py-1.5 text-[13px] font-medium text-[#423B35]">
            {[dateLabel, party.timeStart].filter(Boolean).join(" • ")}
          </Badge>
        ) : null}
        {party.totalPrice != null ? (
          <Badge className="rounded-full border border-[rgba(20,18,16,0.08)] bg-white px-3 py-1.5 text-[13px] font-medium text-[#423B35]">
            {party.totalPrice} {BYN_SYMBOL}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge className="rounded-full border-0 bg-[#EEF8E8] px-3 py-1.5 text-[13px] font-medium text-[#548B2F]">
          <span className="mr-1.5 h-2 w-2 rounded-full bg-[#6CBF3A]" />
          Подтверждено {confirmedCount} из {party.confirmationTotal ?? confirmedCount} исполнителей
        </Badge>
        {declinedCount > 0 ? (
          <Badge className="rounded-full border-0 bg-[#FFF1EE] px-3 py-1.5 text-[13px] font-medium text-[#D74532]">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-[#EF3D2F]" />
            {declinedCount} отказ
          </Badge>
        ) : null}
      </div>
    </section>
  );
}

export function ScenarioFooterBar({
  summary,
  confirmedLabel,
  declinedLabel,
  onBack,
}: {
  summary: string[];
  confirmedLabel: string;
  declinedLabel: string | null;
  onBack?: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-20 mt-8 border-t border-[rgba(20,18,16,0.08)] bg-white/94 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#5C544D]">
          {summary.map((part, index) => (
            <span key={`${part}-${index}`} className="inline-flex items-center gap-3">
              {part}
              {index < summary.length - 1 ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#E7DDD2]" aria-hidden />
              ) : null}
            </span>
          ))}
          <span className="inline-flex items-center gap-2 text-[#548B2F]">
            <span className="h-2 w-2 rounded-full bg-[#6CBF3A]" aria-hidden />
            {confirmedLabel}
          </span>
          {declinedLabel ? (
            <span className="inline-flex items-center gap-2 text-[#D74532]">
              <span className="h-2 w-2 rounded-full bg-[#EF3D2F]" aria-hidden />
              {declinedLabel}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full border-[rgba(20,18,16,0.10)] bg-white px-5 text-[14px] text-[#141210] shadow-none hover:bg-[#FAF7F1]"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Button>
      </div>
    </div>
  );
}

export function ScenarioFinalPage({
  party,
  onBack,
  onClose,
}: ScenarioFinalPageProps) {
  const timelineItems = party.timelineItems ?? [];
  const confirmedCount = timelineItems.filter(
    (item) => item.status === "CONFIRMED",
  ).length;
  const declinedCount = timelineItems.filter(
    (item) => item.status === "DECLINED",
  ).length;

  const stickySummary = useMemo(() => {
    return [
      [formatShortDate(party.dateIso), party.timeStart && party.timeEnd
        ? `${party.timeStart}–${party.timeEnd}`
        : party.timeStart]
        .filter(Boolean)
        .join(" • "),
      party.childName,
      party.guestsLabel ?? "гости уточняются",
      party.totalPrice != null ? `${party.totalPrice} ${BYN_SYMBOL}` : null,
    ].filter(Boolean) as string[];
  }, [party, confirmedCount, declinedCount]);

  const handleShare = async () => {
    const text = `Сценарий праздника ${party.childName} — ${stickySummary.join(" • ")}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Сценарий праздника", text });
        return;
      } catch {
        return;
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/me/birthdays");
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    handleBack();
  };

  return (
    <div className="min-h-screen bg-[#FFFCF8] text-[#141210]">
      <div className="border-b border-[rgba(20,18,16,0.08)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Button
            type="button"
            className="h-9 rounded-full border border-[rgba(20,18,16,0.18)] bg-transparent px-[14px] pl-[10px] text-[13px] font-medium text-[#3A332B] shadow-none hover:bg-transparent"
            onClick={handleClose}
          >
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[rgba(20,18,16,0.08)]">
              <CloseIcon />
            </span>
            Закрыть
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-[rgba(20,18,16,0.10)] bg-white px-4 text-[14px] text-[#141210] shadow-none hover:bg-[#FAF7F1]"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              Поделиться
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-[rgba(20,18,16,0.10)] bg-white px-4 text-[14px] text-[#141210] shadow-none hover:bg-[#FAF7F1]"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Распечатать
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#EF8759]">
            • Заявки отправлены
          </p>
          <h1 className="mt-3 text-[42px] font-semibold leading-none tracking-[-0.03em] text-[#141210] sm:text-[64px]">
            Сценарий праздника
          </h1>
          <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-[#544D46]">
            Ниже — готовый сценарий дня, статусы ответов исполнителей и
            доступные альтернативы.
          </p>
        </div>

        <div className="space-y-4">
          <ScenarioStatusSummary
            party={party}
            confirmedCount={confirmedCount}
            declinedCount={declinedCount}
          />
          <ScenarioTimeline items={timelineItems} totalPrice={party.totalPrice} />
        </div>
      </main>

      <ScenarioFooterBar
        summary={stickySummary}
        confirmedLabel={`${confirmedCount} подтверждено`}
        declinedLabel={declinedCount > 0 ? `${declinedCount} отказ` : null}
        onBack={handleBack}
      />
    </div>
  );
}
