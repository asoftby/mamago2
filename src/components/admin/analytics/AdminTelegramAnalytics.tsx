"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TELEGRAM_BUSINESS_DEMO,
  type TelegramAnalyticsPeriod,
  type TelegramFamilyAnalytics,
} from "@/lib/analytics/telegramAnalyticsTypes";

const PERIODS: Array<{ value: TelegramAnalyticsPeriod; label: string }> = [
  { value: "today", label: "Сегодня" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
];

function Metric({ label, value, note }: {
  label: string; value: number | string; note?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-xs leading-5 text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">
        {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </p>
      {note && <p className="mt-1 text-xs text-stone-500">{note}</p>}
    </div>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{children}</div>;
}

function Section({ title, caption, children }: {
  title: string; caption?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {caption && <p className="mt-0.5 text-sm text-stone-500">{caption}</p>}
      </div>
      {children}
    </section>
  );
}

function Funnel({ rows }: { rows: Array<{ name: string; value: number }> }) {
  const base = Math.max(1, rows[0]?.value ?? 0);
  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
      {rows.map((row) => {
        const percent = Math.max(0, Math.min(100, 100 * row.value / base));
        return (
          <div key={row.name} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-stone-700">{row.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-stone-900">
                {row.value.toLocaleString("ru-RU")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FamilyDashboard({ data }: { data: TelegramFamilyAnalytics }) {
  const total = data.inboxMessages;
  const preparedRate = total ? Math.round(100 * data.draftsPrepared / total) : null;
  const addRate = total ? Math.round(100 * data.confirmedMessages / total) : null;
  const max = Math.max(1, ...data.daily.map((point) => point.received));
  const showDays = data.daily.length > 1;

  return (
    <div className="space-y-7">
      <p className="text-sm text-stone-500">
        Реальные данные бота: <strong>{data.environment}</strong>.
        Активность измеряется по полученным сообщениям, а не по всем командам Telegram.
      </p>
      <Section title="Активность пользователей">
        <MetricGrid>
          <Metric label="Подключено сейчас" value={data.connectedTotal} note="Активные подключения" />
          <Metric label="Новых подключений" value={data.connectedInPeriod} />
          <Metric label="Пользователей с сообщениями" value={data.activeUsers} />
          <Metric label="Вернулись в другой день" value={data.returningUsers}
            note={data.activeUsers ? `${Math.round(data.returningUsers / data.activeUsers * 100)}% активных` : "Нет активности"} />
        </MetricGrid>
      </Section>
      <Section title="Воронка: от сообщения до плана"
        caption="Уникальные пользователи считаются отдельно. Число сообщений и записей может различаться: одно сообщение создаёт несколько пунктов.">
        <MetricGrid>
          <Metric label="Входящих сообщений" value={data.inboxMessages} />
          <Metric label="Пересланных сообщений" value={data.forwardedMessages}
            note="Включая пересланные фото" />
          <Metric label="Подготовлено черновиков" value={data.draftsPrepared}
            note={preparedRate === null ? "Нет данных" : `${preparedRate}% входящих`} />
          <Metric label="Подтверждено сообщений" value={data.confirmedMessages}
            note={addRate === null ? "Нет данных" : `${addRate}% входящих`} />
          <Metric label="Пользователей с черновиками" value={data.usersWithDrafts} />
          <Metric label="Пользователей, подтвердивших" value={data.confirmedUsers} />
          <Metric label="Пользователей с записями в плане" value={data.addedPlanUsers} />
          <Metric label="Добавлено записей в план" value={data.addedPlanItems} />
        </MetricGrid>
        <Funnel rows={[
          { name: "Отправили сообщение", value: data.activeUsers },
          { name: "Получили черновик", value: data.usersWithDrafts },
          { name: "Подтвердили", value: data.confirmedUsers },
        ]} />
      </Section>
      <Section title="Качество и скорость обработки"
        caption="Длительность — время от поступления сообщения до завершения обработки, включая ожидание в очереди.">
        <MetricGrid>
          <Metric label="Среднее время обработки" value={data.avgProcessingSeconds === null ? "—" : `${data.avgProcessingSeconds.toLocaleString("ru-RU")} с`} />
          <Metric label="Ошибок обработки" value={data.failedMessages} />
          <Metric label="Отклонено черновиков" value={data.discardedMessages} />
          <Metric label="Черновиков с исправлениями" value={data.editedMessages} />
          <Metric label="Обработано моделью" value={data.modelCalls} note="По записанному имени модели" />
          <Metric label="Эскалаций на сильную модель" value={data.escalations} />
          <Metric label="Входных токенов" value={data.tokensIn} />
          <Metric label="Выходных токенов" value={data.tokensOut} />
        </MetricGrid>
        <p className="text-xs text-stone-500">
          Денежную стоимость не показываем, пока нет достоверных тарифов по моделям.
          Токены отражают только сохранённые данные обработки.
        </p>
        {data.errorCodes.length > 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-medium">Ошибки по кодам</h3>
            {data.errorCodes.map((item) => (
              <div key={item.code} className="flex justify-between gap-3 border-t py-2 text-sm">
                <span className="break-all font-mono text-stone-600">{item.code}</span>
                <span>{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      {showDays && (
        <Section title="Динамика по дням" caption="Сообщения и новые записи в плане">
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex h-44 min-w-[480px] items-end gap-1">
              {data.daily.map((point) => (
                <div key={point.date} className="flex h-full min-w-0 flex-1 items-end gap-0.5"
                  title={`${point.date}: сообщения — ${point.received}; записи — ${point.addedToPlan}`}>
                  <div className="w-1/2 rounded-t-sm bg-sky-600"
                    style={{ height: `${Math.max(point.received ? 3 : 0, point.received / max * 100)}%` }} />
                  <div className="w-1/2 rounded-t-sm bg-emerald-500"
                    style={{ height: `${Math.max(point.addedToPlan ? 3 : 0, point.addedToPlan / max * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-stone-500">
              <span>■ Сообщения (синий)</span>
              <span>■ Записи в план (зелёный)</span>
            </div>
            <p className="mt-2 text-xs text-stone-400">Подробные значения доступны при наведении на столбцы.</p>
          </div>
        </Section>
      )}
      <p className="text-xs leading-5 text-stone-500">
        Ограничение: входящие элементы удаляются через 30 дней. Показатели рассчитаны
        по сохранившимся данным и не включают сообщения, отклонённые до записи в базу.
        Для долгосрочной статистики потребуется отдельный обезличенный счётчик событий.
      </p>
    </div>
  );
}

function BusinessDemo({ period }: { period: TelegramAnalyticsPeriod }) {
  const data = TELEGRAM_BUSINESS_DEMO[period];
  return (
    <div className="space-y-7">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>Демонстрационные данные.</strong> Все цифры этой вкладки вымышленные
        и не отражают реальных партнёров, заявки или нажатия.
      </div>
      <Section title="Заявки и доставка">
        <MetricGrid>
          <Metric label="Поступило заявок" value={data.applications} />
          <Metric label="Отправлено в Telegram" value={data.delivered} />
          <Metric label="Открыто уведомлений" value={data.opened} />
          <Metric label="Ошибки доставки" value={data.deliveryFailures} />
        </MetricGrid>
      </Section>
      <Section title="Реакция бизнеса">
        <MetricGrid>
          <Metric label="Нажатий по действиям" value={data.actions} />
          <Metric label="Подтверждено" value={data.confirmed} />
          <Metric label="Отклонено" value={data.rejected} />
          <Metric label="Без ответа" value={data.awaitingResponse} />
          <Metric label="Среднее время реакции" value={`${data.averageResponseMinutes} мин`} />
        </MetricGrid>
        <Funnel rows={[
          { name: "Получены заявки", value: data.applications },
          { name: "Доставлены", value: data.delivered },
          { name: "Открыты", value: data.opened },
          { name: "Совершено действие", value: data.actions },
        ]} />
      </Section>
      <Section title="Примеры последних действий">
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {data.recentActions.map((item, index) => (
            <div key={index} className="flex flex-wrap justify-between gap-2 border-b border-stone-100 p-3 text-sm last:border-0">
              <span className="font-medium">{item.application}</span>
              <span className="text-stone-600">{item.outcome}</span>
              <span className="text-stone-500">{item.responseMinutes === null ? "—" : `${item.responseMinutes} мин`}</span>
            </div>
          ))}
        </div>
      </Section>
      <p className="text-xs leading-5 text-stone-500">
        Будущий источник данных: NotificationDelivery (отправка и ошибки) +
        события отслеживаемой кнопки Telegram + переход статуса BookingRequest.
        Переход по обычной URL-кнопке сейчас надёжно не отслеживается.
        Отправка в Telegram не означает прочтение адресатом.
      </p>
    </div>
  );
}

export function AdminTelegramAnalytics() {
  const [period, setPeriod] = useState<TelegramAnalyticsPeriod>("7d");
  const [tab, setTab] = useState("family");
  const [family, setFamily] = useState<TelegramFamilyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "family") return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setFamily(null);
    async function load() {
      try {
        const response = await fetch(
          `/api/admin/analytics/telegram?period=${period}`,
          { signal: controller.signal, credentials: "include", cache: "no-store" },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = (await response.json()) as TelegramFamilyAnalytics;
        if (!controller.signal.aborted) setFamily(result);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить данные");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [period, tab]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto rounded-xl">
            <TabsTrigger value="family">Семьи</TabsTrigger>
            <TabsTrigger value="business">Бизнес</TabsTrigger>
          </TabsList>
        </Tabs>
        <div aria-label="Период аналитики" className="flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-white p-1">
          {PERIODS.map((option) => (
            <button type="button" key={option.value} onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${period === option.value
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-100"}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "family" ? (
        loading ? <p role="status" className="p-4 text-sm text-stone-500">Загрузка данных бота…</p> :
        error ? <p role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">Ошибка загрузки: {error}</p> :
        family ? <FamilyDashboard data={family} /> : null
      ) : <BusinessDemo period={period} />}
    </div>
  );
}
