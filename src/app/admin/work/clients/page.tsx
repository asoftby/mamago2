import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Search, ChevronRight, Building2 } from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { adminPath } from "@/lib/routing/surface";
import { formatAdminDate, formatAdminNumber } from "@/lib/admin/formatRu";
import {
  CLIENT_FILTERS,
  VERIFICATION_LABELS,
  crmClientPath,
  crmClientsHref,
  isCurrentSubscription,
  parseClientFilter,
  parseClientPage,
} from "@/features/work/client360Model";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

export default async function CrmClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect(adminPath(""));

  const params = await searchParams;
  const search = (params.q || "").trim().slice(0, 100);
  const filter = parseClientFilter(params.status);
  const requestedPage = parseClientPage(params.page);
  const conditions: Prisma.BusinessWhereInput[] = [];
  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { legalName: { contains: search, mode: "insensitive" } },
        { unp: { contains: search } },
        { phone: { contains: search } },
        { owner: { email: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (filter === "approved") conditions.push({ verificationStatus: "APPROVED" });
  if (filter === "pending") conditions.push({ verificationStatus: { in: ["PENDING", "NEEDS_INFO"] } });
  if (filter === "disabled") conditions.push({ operationalStatus: { not: "ACTIVE" } });
  const where: Prisma.BusinessWhereInput = conditions.length ? { AND: conditions } : {};

  const total = await prisma.business.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const clients = await prisma.business.findMany({
    where,
    select: {
      id: true,
      name: true,
      legalName: true,
      unp: true,
      verificationStatus: true,
      operationalStatus: true,
      updatedAt: true,
      owner: { select: { email: true, displayName: true } },
      billingAccount: {
        select: {
          currency: true,
          depositBalance: true,
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              status: true,
              currentPeriodEnd: true,
              plan: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { places: true, activities: true, supportThreads: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const now = new Date();

  return (
    <main className="space-y-5 px-4 pb-8 pt-5 sm:px-6 sm:pt-7 xl:px-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-medium text-emerald-700">CRM / Клиенты</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-gray-950">Клиенты</h1>
          <p className="mt-1 text-sm text-gray-500">Реальные бизнес-аккаунты mamaGo, без повторного ввода данных.</p>
        </div>
        <div className="text-sm text-gray-500">Найдено: <strong className="text-gray-900">{formatAdminNumber(total, 0)}</strong></div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <form method="get" action={adminPath("/work/clients")} className="flex items-center gap-2">
          {filter !== "all" && <input type="hidden" name="status" value={filter} />}
          <label className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <span className="sr-only">Поиск клиента</span>
            <input
              name="q"
              type="search"
              defaultValue={search}
              maxLength={100}
              placeholder="Название, УНП, контакт или email"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <button type="submit" className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800">Найти</button>
        </form>
        <nav aria-label="Фильтр клиентов" className="mt-4 flex flex-wrap gap-2">
          {CLIENT_FILTERS.map((item) => (
            <Link
              key={item.value}
              href={crmClientsHref({ filter: item.value, search, page: 1 })}
              aria-current={filter === item.value ? "page" : undefined}
              className={filter === item.value
                ? "rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label="Реестр клиентов">
        {clients.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Building2 className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Клиентов по этим условиям не найдено.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Бизнес</th>
                  <th scope="col" className="px-4 py-3 font-medium">Верификация</th>
                  <th scope="col" className="px-4 py-3 font-medium">Тариф</th>
                  <th scope="col" className="px-4 py-3 font-medium">Объекты</th>
                  <th scope="col" className="px-4 py-3 font-medium">Обновлён</th>
                  <th scope="col" className="w-10 px-4 py-3"><span className="sr-only">Открыть</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => {
                  const subscription = client.billingAccount?.subscriptions.find((item) =>
                    isCurrentSubscription(item.status, item.currentPeriodEnd, now));
                  return (
                    <tr key={client.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-4">
                        <Link href={crmClientPath(client.id)} className="font-semibold text-gray-950 hover:text-emerald-700">
                          {client.name}
                        </Link>
                        <div className="mt-1 text-xs text-gray-500">{client.owner.email}</div>
                        {client.unp && <div className="mt-0.5 text-xs text-gray-400">УНП {client.unp}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={client.verificationStatus === "APPROVED"
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                          : client.verificationStatus === "PENDING" || client.verificationStatus === "NEEDS_INFO"
                            ? "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                            : "rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"}>
                          {VERIFICATION_LABELS[client.verificationStatus]}
                        </span>
                        {client.operationalStatus !== "ACTIVE" && (
                          <p className="mt-2 text-xs text-red-600">Доступ отключён</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-800">{subscription?.plan.name ?? "Без активной подписки"}</div>
                        {client.billingAccount && (
                          <div className="mt-1 text-xs text-gray-500">
                            Депозит: {formatAdminNumber(client.billingAccount.depositBalance.toNumber())} {client.billingAccount.currency}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {client._count.places} мест · {client._count.activities} мероприятий
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-gray-500">{formatAdminDate(client.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <Link href={crmClientPath(client.id)} aria-label={"Открыть клиента " + client.name} className="inline-flex rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Страницы клиентов">
          <Link href={crmClientsHref({ filter, search, page: Math.max(1, page - 1) })}
            aria-disabled={page === 1}
            className={page === 1 ? "pointer-events-none text-sm text-gray-300" : "text-sm font-medium text-emerald-700 hover:underline"}>
            Назад
          </Link>
          <span className="text-xs text-gray-500">Страница {page} из {totalPages}</span>
          <Link href={crmClientsHref({ filter, search, page: Math.min(totalPages, page + 1) })}
            aria-disabled={page === totalPages}
            className={page === totalPages ? "pointer-events-none text-sm text-gray-300" : "text-sm font-medium text-emerald-700 hover:underline"}>
            Вперёд
          </Link>
        </nav>
      )}
    </main>
  );
}
