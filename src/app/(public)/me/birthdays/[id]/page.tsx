import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { BookingStatusPage } from "@/features/me/components/BookingStatusPage";
import {
  formatPartyDateTime,
  getPartyDisplayTitle,
} from "@/features/me/lib/userBirthdayPartyUi";
import { getUserBirthdayPartyDetail } from "@/server/services/userBirthdays.service";
import { readPartyOrder } from "@/server/birthday/partyDraft.service";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { AcceptBirthdayQuoteButton } from "@/features/me/components/AcceptBirthdayQuoteButton";

type PageProps = { params: Promise<{ id: string }> };

export default async function MeBirthdayDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const orderExists = await prisma.partyOrder.findFirst({
    where: { id, ownerUserId: user.id }, select: { id: true },
  });
  if (orderExists) {
    const order = await readPartyOrder(user.id, id);
    const anchor = order.items.find(item => item.role === "ANCHOR");
    const request = anchor?.requests[0];
    const quote = request?.partyQuotes[0];
    const canAccept = process.env.PARTY_CONFIRMATION_ENABLED === "true" &&
      process.env.BUSINESS_BOOKINGS_INBOX_UI === "true" &&
      order.status === "ANCHOR_PENDING" &&
      request?.partyStage === "QUOTED" &&
      quote?.status === "ACTIVE" && quote.type !== "DECLINED" &&
      quote.validUntil && quote.validUntil > new Date();
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link href="/me/birthdays" className="text-sm text-muted-foreground hover:text-foreground">
          ← Мои праздники
        </Link>
        <div className="space-y-1">
          <h1 className="font-editorial text-3xl">{anchor?.offer?.title ?? "Мой праздник"}</h1>
          <p className="text-sm text-muted-foreground">
            {order.eventDate?.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) ?? "Без даты"}
            {order.timeFrom && order.timeTo ? ` · ${order.timeFrom}–${order.timeTo}` : ""}
          </p>
        </div>
        <section className="space-y-4 rounded-2xl border border-border p-5">
          <h2 className="text-lg font-semibold">Предложение площадки</h2>
          {quote ? (
            <>
              <p className="text-sm">
                {request?.partyStage === "CONFIRMED" ? "Площадка подтверждена"
                  : request?.partyStage === "AWAITING_RECONFIRM" ? "Вы приняли условия. Ждём подтверждение бизнеса."
                  : request?.partyStage === "QUOTED" ? "Исполнитель предложил условия"
                  : "Текущий статус: " + (request?.partyStage ?? "Ожидаем ответа")}
              </p>
              {quote.priceByn != null ? <p className="text-lg font-semibold">
                {quote.priceByn.toString()} BYN
              </p> : null}
              {quote.includes ? <p className="whitespace-pre-wrap text-sm">{quote.includes}</p> : null}
              {quote.prepaymentTerms ? <p className="text-sm">Предоплата: {quote.prepaymentTerms}</p> : null}
              {quote.cancellationTerms ? <p className="text-sm">Отмена: {quote.cancellationTerms}</p> : null}
              {quote.validUntil ? <p className="text-xs text-muted-foreground">
                Условия действуют до {quote.validUntil.toLocaleString("ru-RU", { timeZone: "Europe/Minsk" })}
              </p> : null}
              {canAccept && request ? (
                <AcceptBirthdayQuoteButton
                  partyId={order.id} requestId={request.id} version={quote.version}
                />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ожидаем предложения от исполнителя.</p>
          )}
        </section>
      </main>
    );
  }

  const party = await getUserBirthdayPartyDetail(user.id, id);
  if (!party) notFound();
  return <BookingStatusPage party={party} title={getPartyDisplayTitle(party)}
    dateTimeLine={formatPartyDateTime(party)} />;
}
