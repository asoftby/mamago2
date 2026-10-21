import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { listUserBirthdayParties } from "@/server/services/userBirthdays.service";
import { Container } from "@/components/ui/Container";
import { Surface } from "@/components/ui/surface";
import { H2, BodyMuted } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { peachPrimaryCtaLinkClassName } from "@/lib/peachPrimaryCtaLink";
import { ArrowLeft, PartyPopper } from "lucide-react";
import type { UserBirthdayParty } from "@/features/me/types/userBirthdayParty";
import { sortPartiesForProfile } from "@/features/me/lib/userBirthdayPartyUi";
import { BirthdayPartyCard } from "@/features/me/components/BirthdayPartyCard";
import { getBirthdayBuilderHref } from "@/lib/birthday/getBirthdayBuilderHref";
import prisma from "@/lib/prisma";

function isArchived(p: UserBirthdayParty) {
  return p.status === "completed" || p.status === "archived";
}

function isActive(p: UserBirthdayParty) {
  return !isArchived(p);
}

export default async function MeBirthdaysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orders = await prisma.partyOrder.findMany({
    where: { ownerUserId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true, eventDate: true, timeFrom: true, status: true,
      items: { where: { role: "ANCHOR" }, take: 1,
        select: { offer: { select: { title: true } } } },
    },
  });
  const parties = await listUserBirthdayParties(user.id);
  const sorted = sortPartiesForProfile(parties);
  const active = sorted.filter(isActive);
  const archive = sorted.filter(isArchived);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-4xl">
        <div className="mb-6">
          <Link
            href="/me"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            К профилю
          </Link>
        </div>

        <div className="space-y-2 mb-6">
          <H2>Мои праздники</H2>
          <BodyMuted className="text-sm">
            Черновики, заявки и завершённые дни рождения
          </BodyMuted>
        </div>

        {orders.length > 0 ? (
          <section className="mb-8 space-y-3" aria-label="Заявки на праздники">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Заявки и предложения
            </h3>
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/me/birthdays/${encodeURIComponent(order.id)}`}
                className="block rounded-2xl border border-border bg-background p-4 transition-colors hover:bg-muted/50"
              >
                <span className="block font-semibold">
                  {order.items[0]?.offer?.title ?? "Мой праздник"}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {order.eventDate?.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) ?? "Дата не указана"}
                  {order.timeFrom ? ` · ${order.timeFrom}` : ""}
                  {" · "}{order.status === "ANCHOR_CONFIRMED" ? "Площадка подтверждена"
                    : order.status === "ANCHOR_PENDING" ? "Ожидаем подтверждение площадки"
                    : order.status === "NEEDS_ALTERNATIVE" ? "Нужен другой вариант"
                    : order.status === "CANCELLED" ? "Отменён" : "Черновик"}
                </span>
              </Link>
            ))}
          </section>
        ) : null}
        {orders.length === 0 && parties.length === 0 ? (
          <Surface variant="elevated" className="p-8 text-center">
            <BodyMuted className="mb-4">
              Пока нет праздников — создайте сценарий в конструкторе.
            </BodyMuted>
            <Link
              href={getBirthdayBuilderHref()}
              className={cn(peachPrimaryCtaLinkClassName(), "mt-3")}
            >
              <PartyPopper className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 sm:h-[18px] sm:w-[18px]" aria-hidden />
              Создать праздник
            </Link>
          </Surface>
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Активные
                </h3>
                <div className="space-y-2.5">
                  {active.map((p) => (
                    <BirthdayPartyCard key={p.id} party={p} />
                  ))}
                </div>
              </section>
            )}
            {archive.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Архив
                </h3>
                <div className="space-y-2.5">
                  {archive.map((p) => (
                    <BirthdayPartyCard key={p.id} party={p} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}
