import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, Building2, CircleAlert, CreditCard,
  FileText, Headset, MapPin, ShieldCheck, UsersRound,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { adminPath } from "@/lib/routing/surface";
import { formatAdminDate, formatAdminDateTime, formatAdminNumber } from "@/lib/admin/formatRu";
import { BILLING_TRANSACTION_STATUS_LABELS_RU, CONTENT_STATUS_LABELS_RU, CONTRACT_STATUS_LABELS_RU, PLACEMENT_STATUS_LABELS_RU } from "@/lib/admin/labels.ru";
import {
  SUBSCRIPTION_LABELS, VERIFICATION_LABELS, isCurrentSubscription,
} from "@/features/work/client360Model";

export const dynamic = "force-dynamic";

const panel = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5";
const muted = "text-xs font-medium uppercase tracking-wide text-gray-400";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-gray-500">{children}</p>;
}

function Shortcut({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-emerald-400 hover:text-emerald-800">
      {children}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export default async function CrmClientDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect(adminPath(""));

  const { id } = await params;
  const client = await prisma.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      legalName: true,
      unp: true,
      phone: true,
      contactPhoneVerifiedAt: true,
      verificationStatus: true,
      operationalStatus: true,
      submittedAt: true,
      reviewedAt: true,
      createdAt: true,
      owner: {
        select: {
          email: true,
          displayName: true,
          phoneE164: true,
          businessContactVerifiedPhoneE164: true,
          businessContactPhoneVerifiedAt: true,
        },
      },
      members: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, role: true, title: true,
          user: { select: { email: true, displayName: true } },
        },
        take: 12,
      },
      commercialCounterparty: {
        select: { id: true, name: true, contactName: true, phoneE164: true },
      },
      verificationLogs: {
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, createdAt: true, statusTo: true, note: true },
      },
      billingAccount: {
        select: {
          status: true,
          currency: true,
          depositBalance: true,
          lowBalanceThreshold: true,
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true, status: true, currentPeriodEnd: true,
              autoRenew: true, plan: { select: { name: true } },
            },
          },
          transactions: {
            orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
            take: 5,
            select: {
              id: true, type: true, description: true,
              status: true, amount: true, currency: true, occurredAt: true,
            },
          },
        },
      },
      placements: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true, status: true, startsAt: true, endsAt: true,
          plan: { select: { name: true } },
        },
      },
      _count: {
        select: { places: true, activities: true, supportThreads: true, directThreads: true },
      },
    },
  });

  if (!client) notFound();
  const [places, events, offersCount, supportThreads, contracts, openSupportCount] = await Promise.all([
    prisma.place.findMany({
      where: { ownerBusinessId: id },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true, title: true, status: true,
        _count: { select: { offers: true } },
      },
    }),
    prisma.activity.findMany({
      where: { businessId: id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, type: true, status: true },
    }),
    prisma.offer.count({ where: { place: { ownerBusinessId: id } } }),
    prisma.supportThread.findMany({
      where: { businessId: id },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
      select: { id: true, subject: true, status: true, lastMessageAt: true },
    }),
    prisma.businessContract.findMany({
      where: {
        OR: [
          { businessId: id },
          { counterparty: { businessId: id } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, contractNumber: true, status: true, startsAt: true,
        endsAt: true, totalAmount: true, currency: true,
      },
    }),
    prisma.supportThread.count({
      where: { businessId: id, status: { in: ["NEW", "IN_PROGRESS"] } },
    }),
  ]);

  const now = new Date();
  const subscription = client.billingAccount?.subscriptions.find((item) =>
    isCurrentSubscription(item.status, item.currentPeriodEnd, now));
  const lastSubscription = client.billingAccount?.subscriptions[0];
  const balance = client.billingAccount?.depositBalance.toNumber() ?? null;
  const needsAttention = client.verificationStatus === "PENDING"
    || client.verificationStatus === "NEEDS_INFO"
    || client.billingAccount?.status === "SUSPENDED"
    || client.billingAccount?.subscriptions.some((item) => item.status === "PAST_DUE") === true
    || openSupportCount > 0;

  return (
    <main className="space-y-5 px-4 pb-8 pt-5 sm:px-6 sm:pt-7 xl:px-8">
      <Link href={adminPath("/work/clients")} className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Все клиенты
      </Link>

      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600"><Building2 className="h-6 w-6" /></div>
          <div>
            <div className="text-xs font-medium text-emerald-700">CRM / Карточка клиента</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950 sm:text-[28px]">{client.name}</h1>
            {client.legalName && client.legalName !== client.name && <p className="mt-1 text-sm text-gray-500">{client.legalName}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={client.verificationStatus === "APPROVED"
                ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"}>
                {VERIFICATION_LABELS[client.verificationStatus]}
              </span>
              {client.operationalStatus !== "ACTIVE" && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Бизнес отключён</span>}
              {needsAttention && <span className="inline-flex items-center gap-1 text-xs text-amber-700"><CircleAlert className="h-3.5 w-3.5" /> Есть вопросы</span>}
            </div>
          </div>
        </div>
        <nav aria-label="Инструменты клиента" className="flex flex-wrap gap-2">
          <Shortcut href={adminPath("/b2b/partners/" + client.id)}>Управление бизнесом</Shortcut>
          <Shortcut href={adminPath("/businesses/" + client.id + "/commercial")}>Коммерция</Shortcut>
          <Shortcut href={adminPath("/businesses/" + client.id + "/billing")}>Биллинг</Shortcut>
          <Shortcut href={adminPath("/support")}>Поддержка</Shortcut>
        </nav>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <section className={panel}>
          <div className="flex items-center justify-between text-gray-400"><span className={muted}>Подписка</span><CreditCard className="h-4 w-4" /></div>
          <div className="mt-3 text-lg font-semibold text-gray-900">{subscription?.plan.name ?? "Нет активной подписки"}</div>
          <p className="mt-1 text-xs text-gray-500">
            {subscription ? SUBSCRIPTION_LABELS[subscription.status] + " · до " + formatAdminDate(subscription.currentPeriodEnd)
              : lastSubscription ? "Последняя: " + SUBSCRIPTION_LABELS[lastSubscription.status] : "Не оформлена"}
          </p>
        </section>
        <section className={panel}>
          <div className="flex items-center justify-between text-gray-400"><span className={muted}>Депозит</span><CreditCard className="h-4 w-4" /></div>
          <div className="mt-3 text-lg font-semibold text-gray-900">{balance === null ? "Нет счёта" : formatAdminNumber(balance) + " " + client.billingAccount?.currency}</div>
          <p className="mt-1 text-xs text-gray-500">{client.billingAccount ? "Состояние счёта: " + (client.billingAccount.status === "ACTIVE" ? "Активен" : client.billingAccount.status === "SUSPENDED" ? "Приостановлен" : "Закрыт") : "Биллинг не подключён"}</p>
        </section>
        <section className={panel}>
          <div className="flex items-center justify-between text-gray-400"><span className={muted}>Контент</span><MapPin className="h-4 w-4" /></div>
          <div className="mt-3 text-lg font-semibold text-gray-900">{client._count.places} мест · {offersCount} предложений</div>
          <p className="mt-1 text-xs text-gray-500">{client._count.activities} активностей, связанных с бизнесом</p>
        </section>
        <section className={panel}>
          <div className="flex items-center justify-between text-gray-400"><span className={muted}>Поддержка</span><Headset className="h-4 w-4" /></div>
          <div className="mt-3 text-lg font-semibold text-gray-900">{openSupportCount} открытых</div>
          <p className="mt-1 text-xs text-gray-500">Всего обращений: {client._count.supportThreads}</p>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)]">
        <div className="space-y-5">
          <section className={panel}>
            <div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-gray-500" /><h2 className="font-semibold text-gray-900">Контакты</h2></div>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className={muted}>Владелец</dt><dd className="mt-1 font-medium text-gray-900">{client.owner.displayName || client.owner.email}</dd><dd className="mt-0.5 break-all text-gray-500">{client.owner.email}</dd></div>
              <div><dt className={muted}>Контакт бизнеса</dt><dd className="mt-1 text-gray-900">{client.owner.businessContactVerifiedPhoneE164 || client.phone || "—"}</dd>
                <dd className="mt-0.5 text-xs text-gray-500">
                  {client.owner.businessContactPhoneVerifiedAt || client.contactPhoneVerifiedAt ? "Телефон подтверждён" : "Нет отметки о подтверждении"}
                </dd>
              </div>
              <div><dt className={muted}>УНП</dt><dd className="mt-1 text-gray-900">{client.unp || "Не указан"}</dd></div>
              <div><dt className={muted}>Коммерческий контакт</dt><dd className="mt-1 text-gray-900">{client.commercialCounterparty?.contactName || "—"}</dd><dd className="mt-0.5 text-gray-500">{client.commercialCounterparty?.phoneE164 || ""}</dd></div>
            </dl>
            {client.members.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className={muted}>Команда бизнеса</p>
                <div className="mt-3 space-y-2">
                  {client.members.map((member) => (
                    <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-gray-800">{member.user.displayName || member.user.email}</span>
                      <span className="text-xs text-gray-500">{member.title || member.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className={panel}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900"><MapPin className="h-5 w-5 text-gray-500" /> Объекты и публикации</h2>
              <Shortcut href={adminPath("/content/places")}>Весь контент</Shortcut>
            </div>
            {places.length === 0 && events.length === 0 ? (
              <Empty>У бизнеса пока нет связанных мест и мероприятий.</Empty>
            ) : (
              <div className="mt-3 divide-y divide-gray-100">
                {places.map((place) => (
                  <div key={place.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0"><Link href={adminPath("/content/places/" + place.id)} className="font-medium text-gray-900 hover:text-emerald-700">{place.title}</Link>
                      <p className="mt-1 text-xs text-gray-500">Место · {place._count.offers} предложений · {CONTENT_STATUS_LABELS_RU[place.status]}</p>
                    </div>
                    <Link href={adminPath("/content/places/" + place.id)} aria-label={"Открыть " + place.title} className="shrink-0 text-gray-400 hover:text-gray-900"><ArrowUpRight className="h-4 w-4" /></Link>
                  </div>
                ))}
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0"><p className="font-medium text-gray-900">{event.title}</p><p className="mt-1 text-xs text-gray-500">{event.type === "EVENT" ? "Мероприятие" : "Активность"} · {CONTENT_STATUS_LABELS_RU[event.status]}</p></div>
                    <span className="text-xs text-gray-400">Связано с бизнесом</span>
                  </div>
                ))}
              </div>
            )}
            {client._count.places > places.length && <p className="mt-3 text-xs text-gray-500">Показаны последние {places.length} из {client._count.places} мест.</p>}
          </section>

          <section className={panel}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900"><FileText className="h-5 w-5 text-gray-500" /> Договоры и размещения</h2>
              <Shortcut href={adminPath("/commercial/contracts")}>Все договоры</Shortcut>
            </div>
            {contracts.length === 0 ? <Empty>Договоров, связанных с этим бизнесом, пока нет.</Empty> : (
              <div className="mt-3 divide-y divide-gray-100">
                {contracts.map((contract) => (
                  <div key={contract.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div><p className="font-medium text-gray-900">{contract.contractNumber}</p>
                      <p className="mt-1 text-xs text-gray-500">{CONTRACT_STATUS_LABELS_RU[contract.status]} · {formatAdminDate(contract.startsAt)} — {formatAdminDate(contract.endsAt)}</p></div>
                    <span className="text-gray-700">{formatAdminNumber(contract.totalAmount.toNumber())} {contract.currency}</span>
                  </div>
                ))}
              </div>
            )}
            {client.placements.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className={muted}>Размещения</p>
                <div className="mt-2 space-y-2">
                  {client.placements.map((placement) => (
                    <div key={placement.id} className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="text-gray-800">{placement.plan?.name || "Отдельное размещение"} · {PLACEMENT_STATUS_LABELS_RU[placement.status]}</span>
                      <span className="text-xs text-gray-500">до {formatAdminDate(placement.endsAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className={panel}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900"><Headset className="h-5 w-5 text-gray-500" /> Обращения</h2>
              <Shortcut href={adminPath("/support")}>Все обращения</Shortcut>
            </div>
            {supportThreads.length === 0 ? <Empty>Обращений пока не было.</Empty> : (
              <div className="mt-3 divide-y divide-gray-100">
                {supportThreads.map((thread) => (
                  <Link key={thread.id} href={adminPath("/support") + "?thread=" + encodeURIComponent(thread.id)} className="block py-3 hover:text-emerald-700">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900">{thread.subject}</p>
                      <span className={thread.status === "CLOSED" ? "text-xs text-gray-400" : "text-xs text-amber-700"}>
                        {thread.status === "NEW" ? "Новое" : thread.status === "IN_PROGRESS" ? "В работе" : "Закрыто"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{formatAdminDateTime(thread.lastMessageAt)}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className={panel}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900"><CreditCard className="h-5 w-5 text-gray-500" /> Последние транзакции</h2>
              <Shortcut href={adminPath("/businesses/" + client.id + "/billing")}>Открыть биллинг</Shortcut>
            </div>
            {!client.billingAccount?.transactions.length ? <Empty>Транзакций пока нет.</Empty> : (
              <div className="mt-3 divide-y divide-gray-100">
                {client.billingAccount.transactions.map((transaction) => (
                  <div key={transaction.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0"><p className="font-medium text-gray-900">{transaction.description}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatAdminDate(transaction.occurredAt)} · {BILLING_TRANSACTION_STATUS_LABELS_RU[transaction.status]}</p></div>
                    <span className="font-medium text-gray-800">{formatAdminNumber(transaction.amount.toNumber())} {transaction.currency}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={panel}>
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-gray-500" /><h2 className="font-semibold text-gray-900">История верификации</h2></div>
            <p className="mt-2 text-xs text-gray-500">Заявка: {formatAdminDate(client.submittedAt)} · Создан: {formatAdminDate(client.createdAt)}</p>
            {client.verificationLogs.length === 0 ? <Empty>Изменений статуса пока нет.</Empty> : (
              <div className="mt-3 divide-y divide-gray-100">
                {client.verificationLogs.map((log) => (
                  <div key={log.id} className="py-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2"><span className="font-medium text-gray-900">{VERIFICATION_LABELS[log.statusTo]}</span><span className="text-xs text-gray-500">{formatAdminDateTime(log.createdAt)}</span></div>
                    {log.note && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{log.note}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Shortcut href={adminPath("/b2b/partners/" + client.id)}>Проверка и управление</Shortcut>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
