"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Megaphone } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { cn } from "@/lib/utils";

export type BusinessInboxPreviewItem = {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  seenAt: string | null;
};

export function BusinessInboxPreview({
  items,
  notificationsHref,
}: {
  items: BusinessInboxPreviewItem[];
  notificationsHref: string;
}) {
  const messageHref = (id: string) => {
    const separator = notificationsHref.includes("?") ? "&" : "?";
    return `${notificationsHref}${separator}open=${encodeURIComponent(id)}`;
  };

  return (
    <BusinessSurfaceCard className="flex min-h-[196px] flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-stone-800">Что нового в mamaGo</p>
        <Link
          href={notificationsHref}
          className="shrink-0 text-xs text-stone-400 transition hover:text-stone-600"
        >
          Все входящие →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-stone-400">Нет новых сообщений</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={messageHref(item.id)}
              className="group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-stone-50"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition group-hover:bg-white">
                <Megaphone className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "line-clamp-1 text-sm leading-snug text-stone-800",
                    !item.seenAt && "font-semibold",
                  )}
                >
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-stone-400">
                  {formatDistanceToNow(new Date(item.createdAt), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BusinessSurfaceCard>
  );
}
