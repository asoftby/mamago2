"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquareText, Search } from "lucide-react";
import type { ConversationTab, UnifiedConversationListItem } from "@/server/services/direct/directConversation.service";
import { StatusBadge } from "@/components/direct/StatusBadge";
import { UnreadBadge } from "@/components/direct/UnreadBadge";
import { BUSINESS_DIRECT_HREF } from "@/lib/business/navigation";

type Props = {
  initialConversations: UnifiedConversationListItem[];
  initialCounts: Record<ConversationTab, number>;
};

const tabs: { value: ConversationTab; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "ACTIVE", label: "Активные" },
  { value: "WAITING", label: "Ждут ответа" },
  { value: "COMPLETED", label: "Завершённые" },
  { value: "ARCHIVE", label: "Архив" },
];

export function BusinessDirectInbox({ initialConversations, initialCounts }: Props) {
  const [tab, setTab] = useState<ConversationTab>("ALL");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialConversations.filter((item) =>
      (tab === "ALL" || item.tab === tab) &&
      (!needle ||
        item.counterpartyName.toLowerCase().includes(needle) ||
        item.latestPublicationTitle.toLowerCase().includes(needle) ||
        String(item.latestThreadNumber).includes(needle.replace(/^d-?/i, ""))),
    );
  }, [initialConversations, query, tab]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр переписок">
            {tabs.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === value ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {label} <span className="ml-1 tabular-nums">{initialCounts[value]}</span>
              </button>
            ))}
          </div>
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Найти переписку</span>
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Клиент, публикация, номер"
              className="h-10 w-full rounded-full border border-stone-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-stone-400" />
          </label>
        </div>
      </div>
      {visible.length ? (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="divide-y divide-stone-100">
            {visible.map((item) => (
              <Link key={item.key} href={`${BUSINESS_DIRECT_HREF}/${item.latestThreadId}`}
                className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-stone-50 md:flex-nowrap md:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-lg font-semibold text-stone-600">
                  {item.counterpartyLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.counterpartyLogoUrl} alt="" className="h-full w-full object-cover" />
                  ) : item.counterpartyName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-stone-950">{item.counterpartyName}</div>
                  <div className="mt-1 truncate text-xs text-stone-500">{item.latestPublicationTitle}</div>
                  {item.lastMessagePreview && <div className="mt-1 truncate text-sm text-stone-600">{item.lastMessagePreview}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.tab} />
                  <UnreadBadge count={item.unreadCount} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white px-6 py-16 text-center">
          <MessageSquareText className="mx-auto text-stone-400" size={32} />
          <h2 className="mt-4 text-lg font-semibold text-stone-900">
            {initialCounts.ALL ? "Переписки не найдены" : "Пока нет сообщений"}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {initialCounts.ALL ? "Измените фильтры или поисковый запрос." : "Здесь появятся обращения клиентов вашей организации."}
          </p>
        </div>
      )}
    </div>
  );
}
