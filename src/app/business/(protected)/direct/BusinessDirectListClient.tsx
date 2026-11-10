"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Inbox, Mail, Search } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import type {
  ConversationTab,
  UnifiedConversationListItem,
} from "@/server/services/direct/directConversation.service";
import { cn } from "@/lib/utils";

const TABS: { value: ConversationTab; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "WAITING", label: "Ждут ответа" },
  { value: "ACTIVE", label: "В работе" },
  { value: "COMPLETED", label: "Завершённые" },
  { value: "ARCHIVE", label: "Архив" },
];

const STATUS: Record<Exclude<ConversationTab, "ALL">, { label: string; className: string }> = {
  WAITING: { label: "Ждёт ответа", className: "bg-amber-50 text-amber-800" },
  ACTIVE: { label: "В работе", className: "bg-sky-50 text-sky-800" },
  COMPLETED: { label: "Завершено", className: "bg-emerald-50 text-emerald-800" },
  ARCHIVE: { label: "Архив", className: "bg-stone-100 text-stone-600" },
};

function formatActivity(value: Date | string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export function BusinessDirectListClient({
  initialConversations,
}: {
  initialConversations: UnifiedConversationListItem[];
}) {
  const [tab, setTab] = useState<ConversationTab>("ALL");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const result: Record<ConversationTab, number> = {
      ALL: initialConversations.length,
      WAITING: 0, ACTIVE: 0, COMPLETED: 0, ARCHIVE: 0,
    };
    for (const conversation of initialConversations) result[conversation.tab] += 1;
    return result;
  }, [initialConversations]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return initialConversations.filter((item) => {
      if (tab !== "ALL" && item.tab !== tab) return false;
      if (!needle) return true;
      return (
        item.counterpartyName.toLowerCase().includes(needle) ||
        item.latestPublicationTitle.toLowerCase().includes(needle) ||
        String(item.latestThreadNumber).includes(needle.replace(/^d-?/i, ""))
      );
    });
  }, [initialConversations, search, tab]);

  const unreadCount = initialConversations.reduce((sum, item) => sum + item.unreadCount, 0);

  return (
    <div className="space-y-4" data-testid="business-direct-inbox">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Всего переписок", value: counts.ALL, Icon: Mail },
          { label: "Ждут ответа", value: counts.WAITING, Icon: Clock3 },
          { label: "Непрочитанных", value: unreadCount, Icon: Inbox },
        ].map(({ label, value, Icon }) => (
          <BusinessSurfaceCard key={label} className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-stone-500">{label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-stone-950">{value}</p>
            </div>
            <Icon size={22} className="text-stone-400" aria-hidden="true" />
          </BusinessSurfaceCard>
        ))}
      </div>

      <BusinessSurfaceCard className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Статус переписки" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {TABS.map(({ value, label }) => (
              <button
                type="button"
                key={value}
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                  tab === value
                    ? "border-sky-500 bg-sky-50 text-sky-900"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300",
                )}
              >
                {label}
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs tabular-nums text-stone-600">
                  {counts[value]}
                </span>
              </button>
            ))}
          </div>

          <label className="relative block w-full lg:w-72">
            <span className="sr-only">Поиск по перепискам</span>
            <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-stone-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="Клиент, публикация или номер"
              className="h-11 w-full rounded-full border border-stone-200 bg-white pl-10 pr-4 text-sm text-stone-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>
        </div>

        {visible.length ? (
          <div className="overflow-hidden rounded-2xl border border-stone-200" aria-live="polite">
            {visible.map((item) => (
              <Link
                key={item.key}
                href={`/business/direct/${item.latestThreadId}`}
                className="flex min-w-0 flex-col gap-3 border-b border-stone-100 p-4 transition last:border-b-0 hover:bg-stone-50 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-stone-100 text-lg font-semibold text-stone-700">
                    {item.counterpartyLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.counterpartyLogoUrl} alt="" className="h-full w-full object-cover" />
                    ) : item.counterpartyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-stone-950">{item.counterpartyName}</span>
                      {item.unreadCount > 0 && (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                          {item.unreadCount} новых
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      № D-{item.latestThreadNumber} · {item.latestPublicationTitle}
                      {item.occasionCount > 1 ? ` · ${item.occasionCount} обращения` : ""}
                    </p>
                    {item.lastMessagePreview && (
                      <p className="mt-1 line-clamp-1 text-sm text-stone-600">{item.lastMessagePreview}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 pl-14 sm:flex-col sm:items-end sm:pl-0">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS[item.tab].className)}>
                    {STATUS[item.tab].label}
                  </span>
                  <time dateTime={new Date(item.lastMessageAt).toISOString()} className="text-xs text-stone-500">
                    {formatActivity(item.lastMessageAt)}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-200 px-4 py-12 text-center">
            <Inbox size={28} className="mx-auto text-stone-400" aria-hidden="true" />
            <p className="mt-3 font-semibold text-stone-900">
              {initialConversations.length ? "Переписки не найдены" : "Пока нет сообщений"}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {initialConversations.length
                ? "Попробуйте другой фильтр или поисковый запрос."
                : "Обращения клиентов появятся здесь."}
            </p>
          </div>
        )}
      </BusinessSurfaceCard>
    </div>
  );
}
