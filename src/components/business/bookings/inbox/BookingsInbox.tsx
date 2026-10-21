"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCheck, Clock3, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INBOX_KINDS, INBOX_TABS, NEXT_ACTION_LABEL, archiveLabel,
  parseInboxKind, parseInboxTab,
  type InboxItem, type InboxResponse,
} from "@/lib/business/bookingsInbox";
import { cn } from "@/lib/utils";
import { requestBookingsBadgeRefresh } from "../bookingsBadgeEvents";
import { StandardBookingDetails } from "./StandardBookingDetails";
import { PartyConfirmOverlay } from "./PartyConfirmOverlay";
import {
  PartyReplyOverlay, PartyResolveOverlay, VisitOutcomeOverlay,
} from "./InboxActionOverlays";
import { formatInboxDate, formatInboxDateTime, formatInboxSchedule } from "./inboxFormat";

type LoadState = "loading" | "ready" | "error";

export function BookingsInbox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseInboxTab(searchParams.get("tab"));
  const kind = parseInboxKind(searchParams.get("kind"));

  const [response, setResponse] = useState<{ query: string; result: InboxResponse } | null>(null);
  const query = tab + ":" + kind;
  const data = response?.query === query ? response.result : null;
  const [standardId, setStandardId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [reply, setReply] = useState<InboxItem | null>(null);
  const [confirm, setConfirm] = useState<InboxItem | null>(null);
  const [resolve, setResolve] = useState<InboxItem | null>(null);
  const [outcome, setOutcome] = useState<InboxItem | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const res = await fetch(`/api/business/bookings/inbox?tab=${tab}&kind=${kind}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as InboxResponse;
      if (seq !== requestSeq.current) return; // устаревший ответ после смены вкладки
      setResponse({ query: tab + ":" + kind, result: json });
      setState("ready");
    } catch {
      if (seq === requestSeq.current) setState("error");
    }
  }, [tab, kind]);

  useEffect(() => {
    setState("loading");
    void load();
  }, [load]);

  const afterAction = useCallback(() => {
    void load();
    requestBookingsBadgeRefresh();
  }, [load]);

  const navigate = (next: { tab?: string; kind?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next.tab ?? tab);
    params.set("kind", next.kind ?? kind);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const items = data?.items ?? [];
  const waiting = items.filter((i) => i.urgency === "CUSTOMER_WAITING");
  const housekeeping = items.filter((i) => i.urgency === "HOUSEKEEPING");

  return (
    <div className="space-y-4" data-testid="bookings-inbox">
      <div role="tablist" aria-label="Раздел заявок" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {INBOX_TABS.map((t) => {
          const active = t.tab === tab;
          const count = data?.counts[t.bucket];
          const badge = t.tab === "action" ? data?.actionGroups.customerWaiting : undefined;
          return (
            <button
              key={t.tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => navigate({ tab: t.tab })}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                active ? "border-sky-500 bg-sky-50 text-sky-900" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300",
              )}
            >
              {t.label}
              {count !== undefined ? (
                <span className={cn(
                  "rounded-full px-2 text-xs leading-5",
                  badge ? "bg-red-500 text-white" : "bg-stone-100 text-stone-600",
                )}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Тип заявок" className="flex gap-2">
        {INBOX_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            aria-pressed={k.kind === kind}
            onClick={() => navigate({ kind: k.kind })}
            className={cn(
              "h-9 rounded-full px-3.5 text-sm font-medium transition",
              k.kind === kind ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {state === "loading" ? <InboxSkeleton /> : null}
      {state === "error" ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить заявки.{" "}
          <button type="button" className="font-semibold underline" onClick={() => { setState("loading"); void load(); }}>
            Повторить
          </button>
        </div>
      ) : null}

      {data && state === "ready" ? (
        items.length === 0 ? (
          <EmptyInbox tab={tab} data={data} />
        ) : tab === "action" ? (
          <div className="space-y-6">
            {waiting.length > 0 ? (
              <InboxSection title="Клиент ждёт" count={waiting.length}>
                {waiting.map((item) => (
                  <InboxCard key={item.id} item={item} onReply={setReply} onResolve={setResolve} onOutcome={setOutcome} onStandard={setStandardId} onConfirm={setConfirm} />
                ))}
              </InboxSection>
            ) : null}
            {housekeeping.length > 0 ? (
              <InboxSection title="Закройте прошедшие" count={housekeeping.length} muted>
                {housekeeping.map((item) => (
                  <InboxCard key={item.id} item={item} onReply={setReply} onResolve={setResolve} onOutcome={setOutcome} onStandard={setStandardId} onConfirm={setConfirm} />
                ))}
              </InboxSection>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <InboxCard item={item} onReply={setReply} onResolve={setResolve} onOutcome={setOutcome} onStandard={setStandardId} onConfirm={setConfirm} />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {data?.hasMore && state === "ready" ? (
        <p className="text-center text-sm text-stone-500">Показаны первые {items.length} заявок.</p>
      ) : null}

      <StandardBookingDetails id={standardId} onClose={() => setStandardId(null)} onDone={afterAction} />
      <PartyConfirmOverlay item={confirm} onClose={() => setConfirm(null)} onDone={afterAction} />
      <PartyReplyOverlay item={reply} onClose={() => setReply(null)} onDone={afterAction} />
      <PartyResolveOverlay item={resolve} onClose={() => setResolve(null)} onDone={afterAction} />
      <VisitOutcomeOverlay item={outcome} onClose={() => setOutcome(null)} onDone={afterAction} />
    </div>
  );
}

function InboxSection({ title, count, muted, children }: { title: string; count: number; muted?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className={cn("flex items-center gap-2 text-base font-semibold", muted ? "text-stone-500" : "text-stone-950")}>
        {title}
        <span className="rounded-full bg-stone-100 px-2 text-xs font-semibold leading-5 text-stone-600">{count}</span>
      </h2>
      <ul className="space-y-3">
        {Array.isArray(children)
          ? children.map((child, i) => <li key={i}>{child}</li>)
          : <li>{children}</li>}
      </ul>
    </section>
  );
}

function InboxCard({
  item, onReply, onResolve, onOutcome, onStandard, onConfirm,
}: {
  item: InboxItem;
  onReply: (item: InboxItem) => void;
  onResolve: (item: InboxItem) => void;
  onOutcome: (item: InboxItem) => void;
  onStandard: (id: string) => void;
  onConfirm: (item: InboxItem) => void;
}) {
  const isParty = item.kind === "PARTY";
  const deadline = formatInboxDateTime(item.deadline);
  const action = item.nextAction;
  const hint =
    item.bucket === "ARCHIVE"
      ? archiveLabel(item)
      : action === "WAIT_CUSTOMER" && deadline
        ? `Ждём ответ клиента до ${deadline}`
        : action === "EXTEND_OR_CLOSE"
          ? "Срок предложения истёк — продлите или закройте"
          : (action === "RESPOND" || action === "RECONFIRM") && deadline
            ? `${NEXT_ACTION_LABEL[action]} до ${deadline}`
            : NEXT_ACTION_LABEL[action];

  let primary: React.ReactNode = null;
  if (isParty && action === "RESPOND") {
    primary = <Button className="h-11 w-full sm:w-auto" onClick={() => onReply(item)}>Ответить</Button>;
  } else if (isParty && action === "RECONFIRM") {
    primary = (
      <div className="flex flex-wrap gap-2">
        <Button className="h-11" onClick={() => onConfirm(item)}>Подтвердить площадку</Button>
        <Button variant="outline" className="h-11" onClick={() => onReply(item)}>
          Предложить другие условия
        </Button>
      </div>
    );
  } else if (isParty && action === "EXTEND_OR_CLOSE") {
    primary = <Button className="h-11 w-full sm:w-auto" onClick={() => onResolve(item)}>Продлить или закрыть</Button>;
  } else if (!isParty && action === "CLOSE_VISIT") {
    primary = <Button className="h-11 w-full sm:w-auto" onClick={() => onOutcome(item)}>Отметить итог</Button>;
  } else if (!isParty && (action === "RESPOND" || action === "VIEW_UPCOMING" || action === "WAIT_CUSTOMER" || action === "VIEW_ARCHIVE")) {
    primary = <Button variant={action === "RESPOND" ? "default" : "outline"} className="h-11 w-full sm:w-auto" onClick={() => onStandard(item.id)}>{action === "RESPOND" ? "Открыть заявку" : "Подробнее"}</Button>;
  }

  const urgent = item.urgency === "CUSTOMER_WAITING";
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-white p-4 sm:p-5",
        urgent ? "border-sky-200 shadow-[0_8px_28px_rgba(14,116,144,0.08)]" : "border-stone-200",
      )}
      data-testid="inbox-card"
      data-kind={item.kind}
      data-action={action}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", urgent ? "bg-sky-500" : "bg-stone-200")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", isParty ? "bg-pink-50 text-pink-700" : "bg-sky-50 text-sky-700")}>
              {isParty ? <PartyPopper className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
              {isParty ? "Праздник" : "Запись"}
            </span>
            <span className="text-stone-500">Получена {formatInboxDate(item.createdAt)}</span>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-stone-950">
            {item.title ?? (isParty ? "Заявка на праздник" : "Заявка")}
          </h3>
          <p className="text-sm text-stone-600">{formatInboxSchedule(item)}</p>
          <p className={cn("flex items-center gap-1.5 text-sm", urgent ? "font-medium text-sky-800" : "text-stone-500")}>
            <Clock3 className="h-4 w-4 shrink-0" />
            {hint}
          </p>
        </div>
        {primary ? <div className="shrink-0">{primary}</div> : null}
      </div>
    </article>
  );
}

function EmptyInbox({ tab, data }: { tab: string; data: InboxResponse }) {
  if (tab !== "action") {
    return (
      <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
        В этом разделе пока пусто
      </div>
    );
  }
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 text-center sm:p-8" data-testid="inbox-empty">
      <CheckCheck className="mx-auto h-10 w-10 text-emerald-500" />
      <h2 className="mt-3 text-xl font-semibold text-stone-950">Всё обработано</h2>
      <p className="mt-1 text-sm text-stone-500">Новых заявок, требующих ответа, нет.</p>
      {data.nearestUpcoming.length > 0 ? (
        <div className="mt-6 text-left">
          <h3 className="text-sm font-semibold text-stone-700">Ближайшие</h3>
          <ul className="mt-2 divide-y divide-stone-100 rounded-2xl border border-stone-200">
            {data.nearestUpcoming.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 truncate font-medium text-stone-900">{u.title ?? (u.kind === "PARTY" ? "Праздник" : "Запись")}</span>
                <span className="shrink-0 text-stone-500">{formatInboxDate(u.serviceEndsAt) ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-stone-100" />)}
    </div>
  );
}
