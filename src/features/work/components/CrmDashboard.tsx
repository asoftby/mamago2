"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle, ArrowRight, CalendarDays, Check, ChevronRight, CircleHelp,
  Clock3, Handshake, Headset, LoaderCircle, Plus, RefreshCw, Search, UsersRound,
} from "lucide-react";
import Link from "next/link";
import { adminPath } from "@/lib/routing/surface";
import { useCrmDashboardData } from "../useCrmDashboardData";
import {
  type CrmLead, type WorkItem, minskDateTime,
  workStatusColor, workStatusLabel,
} from "../workDashboardModel";
import { CrmCreateDialog } from "./CrmCreateDialog";
import { CrmItemDialog } from "./CrmItemDialog";

interface Props {
  actorId: string;
  openSupportCount: number | null;
}

type CreateState = { mode: "task" | "lead"; leadId?: string } | null;

const panel = "rounded-2xl border border-gray-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.025)]";

function MetricCard({
  icon: Icon, label, value, detail, href,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number | null;
  detail: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div className="mt-4 flex items-baseline justify-between gap-2">
        <strong className="text-3xl font-semibold tracking-tight text-gray-950 tabular-nums">
          {value == null ? "—" : value.toLocaleString("ru-RU")}
        </strong>
        {href && <ChevronRight className="h-4 w-4 text-gray-300" />}
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{label}</div>
      <div className="mt-1 text-xs text-gray-500">{detail}</div>
    </>
  );
  const className = `${panel} block min-w-0 p-4 transition-colors sm:p-5 ${href ? "hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-500" : ""}`;
  return href
    ? <Link className={className} href={href}>{content}</Link>
    : <div className={className}>{content}</div>;
}

function Tag({ item }: { item: WorkItem }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${workStatusColor(item)}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {workStatusLabel(item)}
    </span>
  );
}

function DataEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-gray-500">{children}</p>;
}

function CrmLeadTable({
  leads, actorId, onCreateTask,
}: {
  leads: CrmLead[];
  actorId: string;
  onCreateTask: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[680px] w-full border-collapse text-left text-sm">
        <thead className="bg-gray-50/90 text-xs font-medium text-gray-500">
          <tr>
            <th className="px-5 py-3 font-medium sm:px-6">Бизнес</th>
            <th className="px-4 py-3 font-medium">Статус</th>
            <th className="px-4 py-3 font-medium">Ответственный</th>
            <th className="px-4 py-3 font-medium">Ближайшее дело</th>
            <th className="w-12 px-3 py-3"><span className="sr-only">Действие</span></th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => {
            // The backend provides each lead's next open task across all admins.
            const next = lead.workItems?.[0];
            const linked = Boolean(lead.businessId);
            const status = linked ? "Клиент" : next
              ? next.status === "WAITING" ? "Ждём клиента" : "В работе"
              : "Новый лид";
            const tagColor = linked ? "bg-emerald-50 text-emerald-800" : next
              ? "bg-amber-50 text-amber-800" : "bg-violet-50 text-violet-800";
            return (
              <tr key={lead.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                <td className="px-5 py-3 sm:px-6">
                  <div className="font-semibold text-gray-900">{lead.name}</div>
                  {(lead.contactName || lead.phoneE164) && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      {[lead.contactName, lead.phoneE164].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tagColor}`}>{status}</span></td>
                <td className="px-4 py-3 text-gray-600">
                  {next?.assigneeId === actorId ? "Вы" : next?.assignee?.displayName || (next ? "Сотрудник" : "—")}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {next?.dueAt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                      {minskDateTime(next.dueAt, "full")}
                    </span>
                  ) : <span className="text-gray-400">Нет запланированного дела</span>}
                </td>
                <td className="px-3 py-3">
                  {!linked && <button type="button" title="Запланировать дело" aria-label={`Новое дело для ${lead.name}`}
                    onClick={() => onCreateTask(lead.id)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700">
                    <Plus className="h-4 w-4" />
                  </button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CrmDashboard({ actorId, openSupportCount }: Props) {
  const data = useCrmDashboardData(actorId);
  const [search, setSearch] = useState("");
  const [createState, setCreateState] = useState<CreateState>(null);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const query = search.trim().toLocaleLowerCase("ru-RU");
  const filteredToday = useMemo(() => data.todayItems.filter(item =>
    !query || [item.title, item.nextAction, item.business?.name, item.lead?.name]
      .some(text => text?.toLocaleLowerCase("ru-RU").includes(query)),
  ), [data.todayItems, query]);
  const filteredLeads = useMemo(() => data.leads.filter(lead =>
    !query || [lead.name, lead.contactName, lead.email, lead.phoneE164]
      .some(text => text?.toLocaleLowerCase("ru-RU").includes(query)),
  ), [data.leads, query]);
  const visibleLeads = showAllLeads ? filteredLeads : filteredLeads.slice(0, 5);
  const upcoming = useMemo(() => data.upcomingItems.filter(item =>
    !query || [item.title, item.business?.name, item.lead?.name]
      .some(text => text?.toLocaleLowerCase("ru-RU").includes(query)),
  ), [data.upcomingItems, query]);

  async function completeItem(item: WorkItem) {
    setCompletingId(item.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/work/items/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE", expectedUpdatedAt: item.updatedAt }),
      });
      if (!response.ok) {
        throw new Error(response.status === 409
          ? "Это дело изменено другим сотрудником. Обновите список."
          : "Не получилось завершить дело.");
      }
      data.refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Ошибка");
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-950">CRM</h1>
        <p className="mt-1 text-sm text-gray-500">Простой центр работы с лидами и клиентами</p>
      </header>

      <div className={`${panel} flex flex-col gap-3 p-3 sm:flex-row sm:items-center`}>
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
          <span className="sr-only">Поиск по делам и лидам</span>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Поиск по бизнесу, контакту или делу"
            className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-11 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
        </label>
        <button type="button" onClick={() => setCreateState({ mode: "task" })}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-500">
          <Plus className="h-4.5 w-4.5" strokeWidth={2} />
          Новое дело
        </button>
      </div>

      {data.error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="flex-1">{data.error}</span>
          <button type="button" onClick={data.refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 font-medium">
            <RefreshCw className="h-4 w-4" /> Повторить
          </button>
        </div>
      )}
      {actionError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" /> {actionError}
        </div>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className={`${panel} min-w-0 overflow-hidden`} aria-labelledby="crm-today-title">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
            <div>
              <h2 id="crm-today-title" className="text-lg font-semibold text-gray-950">Сегодня</h2>
              <p className="mt-0.5 text-xs text-gray-500">Что сделать сегодня — ваш рабочий список</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              {data.loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {data.loading ? "Загрузка" : `${filteredToday.length} задач`}
            </span>
          </div>

          {data.loading ? <DataEmpty>Загружаем дела…</DataEmpty> :
            data.error ? <DataEmpty>Список недоступен до подключения CRM API.</DataEmpty> :
            filteredToday.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Check className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
                <p className="font-medium text-gray-800">
                  {query ? "По запросу ничего не найдено" : "Нет дел, требующих внимания сегодня"}
                </p>
                <p className="mt-1 text-sm text-gray-500">{query ? "Попробуйте изменить запрос" : "Новые дела можно добавить одной кнопкой"}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 px-3 sm:px-5">
                {filteredToday.slice(0, 12).map(item => (
                  <div key={item.id} className="group flex min-w-0 items-center gap-3 py-3.5">
                    <button type="button" onClick={() => completeItem(item)}
                      disabled={completingId === item.id} aria-label={`Отметить выполненным: ${item.title}`}
                      title="Завершить дело"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-400 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50">
                      {completingId === item.id && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    </button>
                    <button type="button" onClick={() => setSelectedItem(item)}
                      className="min-w-0 flex-1 text-left focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-emerald-500">
                      <div className="truncate text-sm font-semibold text-gray-900 group-hover:text-emerald-800">
                        {item.business?.name ?? item.lead?.name ?? item.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-gray-500">
                        {item.nextAction || item.title}
                      </div>
                    </button>
                    {item.dueAt && (
                      <span className={`hidden shrink-0 items-center gap-1.5 text-xs sm:inline-flex ${new Date(item.dueAt).getTime() < Date.now() ? "text-red-600" : "text-gray-500"}`}>
                        <Clock3 className="h-3.5 w-3.5" /> {minskDateTime(item.dueAt)}
                      </span>
                    )}
                    <span className="hidden md:block"><Tag item={item} /></span>
                    <button type="button" aria-label={`Открыть дело: ${item.title}`}
                      onClick={() => setSelectedItem(item)} className="rounded-md p-1.5 text-gray-300 hover:bg-gray-50 hover:text-gray-700">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {filteredToday.length > 12 && (
                  <div className="py-3 text-center text-xs text-gray-500">
                    Показаны первые 12 из {filteredToday.length} задач
                  </div>
                )}
              </div>
            )}
        </section>

        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard icon={UsersRound} label="Лиды" value={data.error ? null : data.totalLeads}
              detail="Всего обращений" />
            <MetricCard icon={Handshake} label="Сделки" value={data.error ? null : data.activeSales}
              detail="Активные продажи" />
            <MetricCard icon={Headset} label="Сервис" value={openSupportCount}
              detail="Открытые обращения" href={adminPath("/support")} />
          </div>

          <section className={`${panel} min-w-0`} aria-labelledby="crm-upcoming-title">
            <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
              <h2 id="crm-upcoming-title" className="text-base font-semibold text-gray-950">Ближайшие задачи</h2>
              <CalendarDays className="h-4.5 w-4.5 text-gray-400" />
            </div>
            {data.loading ? <DataEmpty>Загружаем…</DataEmpty> :
              data.error ? <DataEmpty>Дела пока недоступны.</DataEmpty> :
              upcoming.length === 0 ? <DataEmpty>В ближайшие дни задач нет.</DataEmpty> :
              <div className="divide-y divide-gray-100 px-5 pb-3 sm:px-6">
                {upcoming.map(item => (
                  <button key={item.id} type="button" onClick={() => setSelectedItem(item)}
                    className="flex w-full min-w-0 items-center gap-3 py-3 text-left hover:text-emerald-700 focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-emerald-500">
                    <Clock3 className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="shrink-0 text-xs text-gray-500">{item.dueAt ? minskDateTime(item.dueAt, "full") : "—"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                      {item.business?.name ?? item.lead?.name ?? item.title}
                      {(item.business || item.lead) && <span className="text-gray-500"> — {item.title}</span>}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </button>
                ))}
              </div>}
          </section>
        </div>
      </div>

      <section className={`${panel} min-w-0 overflow-hidden`} aria-labelledby="crm-leads-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h2 id="crm-leads-title" className="text-lg font-semibold text-gray-950">Лиды в работе</h2>
            <p className="mt-0.5 text-xs text-gray-500">Текущие обращения и ближайшие действия</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCreateState({ mode: "lead" })}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              <Plus className="h-3.5 w-3.5" /> Новый лид
            </button>
            {filteredLeads.length > 5 && (
              <button type="button" onClick={() => setShowAllLeads(value => !value)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100">
                {showAllLeads ? "Свернуть" : "Показать больше"} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {data.loading ? <DataEmpty>Загружаем лиды…</DataEmpty> :
          data.error ? <DataEmpty>Данные лидов пока недоступны.</DataEmpty> :
          visibleLeads.length === 0 ? <DataEmpty>{query ? "По запросу лидов не найдено." : "Лидов пока нет. Добавьте первый запрос от бизнеса."}</DataEmpty> :
          <CrmLeadTable leads={visibleLeads} actorId={actorId}
            onCreateTask={leadId => setCreateState({ mode: "task", leadId })} />
        }
        {!data.loading && !data.error && data.totalLeads != null && data.totalLeads > data.leads.length && (
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500 sm:px-6">
            Показаны последние {data.leads.length} из {data.totalLeads} лидов. Поиск работает по загруженным записям.
          </p>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-gray-400">
        <CircleHelp className="h-3.5 w-3.5" />
        Статусы бизнеса, публикаций и платежей остаются в исходных разделах mamaGo. Здесь — только рабочие дела и лиды.
      </p>

      {createState && <CrmCreateDialog key={createState.leadId ?? createState.mode}
        leads={data.leads} defaultMode={createState.mode} defaultLeadId={createState.leadId}
        onClose={() => setCreateState(null)} onSaved={data.refresh} />}
      {selectedItem && <CrmItemDialog key={selectedItem.id} item={selectedItem}
        onClose={() => setSelectedItem(null)} onSaved={data.refresh} />}
    </div>
  );
}
