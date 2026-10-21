"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PartyOrderScreenData = {
  id: string;
  childName: string;
  status: string;
  date: string | null;
  time: string | null;
  items: Array<{
    id: string;
    title: string;
    role: string;
    status: string;
    request: {
      id: string;
      partyStage: string | null;
      quote: {
        id: string;
        version: number;
        status: string;
        priceByn: string | null;
        includes: string | null;
        prepaymentTerms: string | null;
        cancellationTerms: string | null;
        validUntil: string | null;
        canAccept: boolean;
      } | null;
    } | null;
  }>;
};

const stageLabels: Record<string, string> = {
  SENT: "Ожидаем ответ исполнителя",
  QUOTED: "Есть предложение",
  AWAITING_RECONFIRM: "Условия приняты — ждём подтверждения",
  CONFIRMED: "Подтверждено исполнителем",
  DECLINED: "Исполнитель отказал",
  EXPIRED: "Срок ответа истёк",
  NOT_ACCEPTED: "Предложение закрыто",
  CANCELLED: "Отменено",
};

export function PartyOrderStatusScreen({ party }: { party: PartyOrderScreenData }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = async (requestId: string, quoteId: string, expectedVersion: number) => {
    if (pending) return;
    setPending(quoteId);
    setError(null);
    try {
      const res = await fetch(
        `/api/parent/parties/${encodeURIComponent(party.id)}/quotes/${encodeURIComponent(quoteId)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, expectedVersion }),
        },
      );
      if (!res.ok) {
        const result = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "Не удалось принять предложение");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось принять предложение");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto w-full max-w-3xl space-y-7 px-4 sm:px-6">
        <Link href="/me/birthdays" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Мои праздники
        </Link>
        <header className="space-y-2">
          <h1 className="font-editorial text-3xl text-foreground sm:text-4xl">
            Праздник {party.childName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {party.date ? new Date(party.date + "T12:00:00Z").toLocaleDateString("ru-RU", {
              day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
            }) : "Дата уточняется"}
            {party.time ? " · " + party.time : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Вы можете принимать предложения исполнителей. Бронирование считается завершённым
            только после подтверждения исполнителем.
          </p>
        </header>

        {error ? <p role="alert" className="rounded-xl border border-destructive/20 p-3 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-4">
          {party.items.filter((item) => item.role !== "INCLUDED").map((item) => {
            const stage = item.request?.partyStage;
            const quote = item.request?.quote;
            const isAvailable = stage === "QUOTED" && quote?.canAccept === true;
            const confirmed = stage === "CONFIRMED";
            return (
              <section key={item.id} className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      {confirmed ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> :
                        <Clock3 className="h-4 w-4" aria-hidden />}
                      {stage ? stageLabels[stage] ?? "Ожидаем действий" :
                        item.status === "PLANNED" ? "Будет отправлено после подтверждения основной услуги" :
                          item.status === "NEEDS_DECISION" ? "Нужен новый выбор" : "В подготовке"}
                    </p>
                  </div>
                  {quote?.priceByn ? (
                    <span className="shrink-0 font-semibold tabular-nums">
                      {Number(quote.priceByn).toLocaleString("ru-RU")} BYN
                    </span>
                  ) : null}
                </div>
                {quote && (isAvailable || stage === "AWAITING_RECONFIRM" || confirmed) ? (
                  <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
                    {quote.includes ? <p><span className="font-medium">Включено:</span> {quote.includes}</p> : null}
                    {quote.prepaymentTerms ? <p><span className="font-medium">Предоплата:</span> {quote.prepaymentTerms}</p> : null}
                    {quote.cancellationTerms ? <p><span className="font-medium">Отмена:</span> {quote.cancellationTerms}</p> : null}
                    {isAvailable && quote.validUntil ? (
                      <p className="text-muted-foreground">
                        Предложение действительно до {new Date(quote.validUntil).toLocaleString("ru-RU")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {isAvailable && item.request && quote ? (
                  <button
                    type="button"
                    disabled={Boolean(pending)}
                    className={cn("inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground",
                      "hover:opacity-90 disabled:opacity-50")}
                    onClick={() => void accept(item.request!.id, quote.id, quote.version)}
                  >
                    {pending === quote.id ? "Принимаем…" : "Принять предложение"}
                  </button>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
