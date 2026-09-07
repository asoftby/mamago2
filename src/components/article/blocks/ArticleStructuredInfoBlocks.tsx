import type { ComponentType, ReactNode } from "react";
import {
  Banknote,
  Clock,
  ExternalLink,
  Info,
  Instagram,
  Mail,
  Map as MapIcon,
  Phone,
  Send,
  Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SharedContactsData } from "@/domain/contacts/structuredContacts";
import { formatSharedPrice, type SharedPriceData } from "@/domain/pricing/structuredPrice";
import { OPENING_HOURS_DAYS, type SharedOpeningHoursData } from "@/domain/opening-hours/structuredOpeningHours";
import { getOpeningStatus, getTodayIntervals } from "@/server/services/openingHours/openingHours.service";
import {
  compareTime,
  formatDateInTimezone,
  getDayOfWeekInTimezone,
  getTimeStringInTimezone,
} from "@/server/services/openingHours/openingHours.utils";
import { JS_DAY_TO_DAY_OF_WEEK } from "@/server/services/openingHours/openingHours.types";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { CopyCoordinatesButton } from "./CopyCoordinatesButton";
import { OpeningHoursSchedule } from "./OpeningHoursSchedule";
import {
  ArticleStructuredBlockImpression,
  ArticleStructuredTrackedAnchor,
  type ArticleStructuredAnalyticsContext,
} from "./ArticleStructuredBlockAnalytics";

const DAY: Record<(typeof OPENING_HOURS_DAYS)[number], string> = { MON: "Понедельник", TUE: "Вторник", WED: "Среда", THU: "Четверг", FRI: "Пятница", SAT: "Суббота", SUN: "Воскресенье" };
const WEEKDAY_FULL: Record<(typeof OPENING_HOURS_DAYS)[number], string> = { MON: "понедельник", TUE: "вторник", WED: "среда", THU: "четверг", FRI: "пятница", SAT: "суббота", SUN: "воскресенье" };
const SOCIAL_LABEL: Record<SharedContactsData["socials"][number]["kind"], string> = { instagram: "Instagram", telegram: "Telegram", vk: "ВКонтакте", tiktok: "TikTok", youtube: "YouTube", other: "Ссылка" };

function VkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 7.5h3c.3 3.3 1.8 5.6 3 6.2V7.5h2.9v4.4c1.2-.2 2.5-1.9 2.9-4.4h2.9c-.3 2.6-1.7 4.4-2.7 5.2 1 .6 2.6 2.2 3.2 4.8h-3.2c-.5-1.7-1.7-3-3.1-3.2v3.2h-.5c-4.1 0-7.1-2.9-8.4-10z" />
    </svg>
  );
}

const SOCIAL_ICON: Record<SharedContactsData["socials"][number]["kind"], ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  telegram: Send,
  vk: VkIcon,
  tiktok: ExternalLink,
  youtube: Youtube,
  other: ExternalLink,
};

function Shell({ icon, title, meta, children }: { icon: ReactNode; title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="not-prose my-8 rounded-2xl border border-border bg-surface-subtle p-5 shadow-sm md:my-10 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">{icon}</span>
        <h2 className="font-serif text-xl tracking-tight md:text-2xl">{title}</h2>
        <span className="h-px min-w-4 flex-1 bg-border" />
        {meta && <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function TrackedShell({
  analytics,
  icon,
  title,
  meta,
  children,
}: {
  analytics?: ArticleStructuredAnalyticsContext;
  icon: ReactNode;
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <ArticleStructuredBlockImpression context={analytics}>
      <Shell icon={icon} title={title} meta={meta}>{children}</Shell>
    </ArticleStructuredBlockImpression>
  );
}

const pill = "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-foreground/40";
const pillPrimary = "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 text-xs font-medium !text-white transition-colors hover:bg-primary-hover hover:!text-white focus-visible:!text-white [&_svg]:!text-white";

function Row({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-border py-3 first:border-t-0 first:pt-0">
      <span className="order-first w-full shrink-0 pt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground sm:order-none sm:w-[74px]">{label}</span>
      <span className="min-w-0 flex-1 break-words text-[15px]">{children}</span>
      {action && <span className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">{action}</span>}
    </div>
  );
}

function contactMapHref(data: SharedContactsData): string | null {
  if (data.mapUrl) return data.mapUrl;
  if (!data.coordinates) return null;
  const query = encodeURIComponent(`${data.coordinates.latitude},${data.coordinates.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function ArticleContactsBlock({
  data,
  analytics,
}: {
  data: SharedContactsData;
  analytics?: ArticleStructuredAnalyticsContext;
}) {
  const mapHref = contactMapHref(data);
  if (!data.address && !data.email && !data.website && !mapHref && data.phones.length === 0 && data.socials.length === 0) return null;
  return (
    <TrackedShell analytics={analytics} icon={<Phone className="h-[18px] w-[18px]" />} title="Контакты">
      <div>
        {data.address && (
          <Row
            label="Адрес"
            action={
              <>
                {data.coordinates && <CopyCoordinatesButton analytics={analytics} value={`${data.coordinates.latitude}, ${data.coordinates.longitude}`} />}
                {mapHref && (
                  <ArticleStructuredTrackedAnchor context={analytics} action="route" href={mapHref} target="_blank" rel="noreferrer" className={pill}>
                    <MapIcon className="h-3.5 w-3.5" />Маршрут
                  </ArticleStructuredTrackedAnchor>
                )}
              </>
            }
          >
            <span className="font-semibold">{data.address}</span>
            {data.coordinates && (
              <small className="mt-0.5 block text-xs text-muted-foreground">{data.coordinates.latitude}, {data.coordinates.longitude}</small>
            )}
          </Row>
        )}
        {!data.address && mapHref && (
          <Row label="Адрес">
            <ArticleStructuredTrackedAnchor context={analytics} action="route" className="underline underline-offset-2" href={mapHref} target="_blank" rel="noreferrer">Открыть на карте</ArticleStructuredTrackedAnchor>
          </Row>
        )}
        {data.phones.map((phone, index) => (
          <Row
            key={`${phone.value}-${index}`}
            label={phone.label || "Телефон"}
            action={
              <ArticleStructuredTrackedAnchor context={analytics} action="phone" actionItemId={`phone_${index + 1}`} href={`tel:${phone.value}`} className={pillPrimary}>
                <Phone className="h-3.5 w-3.5" />Позвонить
              </ArticleStructuredTrackedAnchor>
            }
          >
            <span className="font-mono text-[14.5px]">{phone.value}</span>
          </Row>
        ))}
        {data.email && (
          <Row
            label="Почта"
            action={
              <ArticleStructuredTrackedAnchor context={analytics} action="email" href={`mailto:${data.email}`} className={pill}>
                <Mail className="h-3.5 w-3.5" />Написать
              </ArticleStructuredTrackedAnchor>
            }
          >
            <span className="font-mono text-[14.5px]">{data.email}</span>
          </Row>
        )}
        {data.website && (
          <Row label="Сайт">
            <ArticleStructuredTrackedAnchor context={analytics} action="website" href={data.website} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 break-all font-semibold text-brand">
              {data.website}<ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </ArticleStructuredTrackedAnchor>
          </Row>
        )}
        {data.socials.length > 0 && (
          <Row label="Соцсети">
            <span className="flex flex-wrap gap-1.5">
              {data.socials.map((social, index) => {
                const Icon = SOCIAL_ICON[social.kind];
                return (
                  <ArticleStructuredTrackedAnchor
                    key={`${social.url}-${index}`}
                    context={analytics}
                    action="social"
                    actionItemId={`${social.kind}_${index + 1}`}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    title={SOCIAL_LABEL[social.kind]}
                    aria-label={SOCIAL_LABEL[social.kind]}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:border-foreground hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </ArticleStructuredTrackedAnchor>
                );
              })}
            </span>
          </Row>
        )}
      </div>
    </TrackedShell>
  );
}

function pluralizeItems(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "позиция";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "позиции";
  return "позиций";
}

export function ArticlePriceBlock({
  data,
  analytics,
}: {
  data: SharedPriceData;
  analytics?: ArticleStructuredAnalyticsContext;
}) {
  const summary = formatSharedPrice(data);
  if (!summary && data.items.length === 0 && !data.note.trim()) return null;
  return (
    <TrackedShell
      analytics={analytics}
      icon={<Banknote className="h-[18px] w-[18px]" />}
      title="Стоимость"
      meta={data.items.length > 0 ? `${data.items.length} ${pluralizeItems(data.items.length)}` : undefined}
    >
      <div>
        {data.items.length > 0 ? (
          data.items.map((item) => (
            <div key={item.id} className="flex items-baseline gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
              <span className="min-w-0">
                <span className="text-[15px] font-medium">{item.label}</span>
                {item.description && <small className="mt-0.5 block text-xs text-muted-foreground">{item.description}</small>}
              </span>
              <span className="mb-1 h-0 flex-1 border-b border-dotted border-border" />
              <span
                className={cn(
                  "whitespace-nowrap font-mono text-base font-semibold",
                  /бесплатно|free/i.test(item.price) && "text-success",
                )}
              >
                {item.price}
                {item.unit && (
                  <em className="ml-1 text-[11px] font-normal not-italic text-muted-foreground">
                    {renderCurrencyText(normalizeUiCurrencyText(item.unit), { iconSize: "sm" })}
                  </em>
                )}
              </span>
            </div>
          ))
        ) : summary ? (
          <p className={cn("text-lg font-semibold", data.mode === "FREE" && "text-success")}>
            {renderCurrencyText(summary, { iconSize: "text" })}
          </p>
        ) : null}
        {data.note.trim() && (
          <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />{data.note}
          </p>
        )}
      </div>
    </TrackedShell>
  );
}

function intervals(items: Array<{ startTime: string; endTime: string }>) {
  return items.map((item) => `${item.startTime}–${item.endTime}`).join(", ");
}

function todaysDayKey(timezone: string, now: Date): (typeof OPENING_HOURS_DAYS)[number] {
  const jsDay = getDayOfWeekInTimezone(now, timezone) as keyof typeof JS_DAY_TO_DAY_OF_WEEK;
  return JS_DAY_TO_DAY_OF_WEEK[jsDay];
}

export function ArticleOpeningHoursBlock({
  data,
  analytics,
}: {
  data: SharedOpeningHoursData;
  analytics?: ArticleStructuredAnalyticsContext;
}) {
  const hasWeekly = data.rules.some((rule) => rule.isOpen);
  if (data.mode === "WEEKLY" && !hasWeekly && data.exceptions.length === 0 && !data.note) return null;

  if (data.mode !== "WEEKLY") {
    const modeLabel = data.mode === "ALWAYS_OPEN" ? "Круглосуточно" : data.mode === "BY_APPOINTMENT" ? "По предварительной записи" : "Временно закрыто";
    return (
      <TrackedShell analytics={analytics} icon={<Clock className="h-[18px] w-[18px]" />} title="Режим работы">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Clock className="h-[22px] w-[22px]" />
          </span>
          <span>
            <span className="block font-serif text-2xl tracking-tight">{modeLabel}</span>
            {data.note && <span className="mt-1 block text-sm text-muted-foreground">{data.note}</span>}
          </span>
        </div>
      </TrackedShell>
    );
  }

  const now = new Date();
  const todayKey = todaysDayKey(data.timezone, now);
  const todayLabel = WEEKDAY_FULL[todayKey];
  const todayDate = formatDateInTimezone(now, data.timezone);
  const todayException = data.exceptions.find((item) => item.date === todayDate);
  const todayIntervals = getTodayIntervals(data, now);
  const currentTime = getTimeStringInTimezone(now, data.timezone);
  const status = getOpeningStatus(data, now);
  const currentInterval = status.isOpen
    ? todayIntervals.find((interval) => {
        const afterStart = compareTime(currentTime, interval.startTime);
        const beforeEnd = compareTime(currentTime, interval.endTime);
        return afterStart !== null && beforeEnd !== null && afterStart >= 0 && beforeEnd < 0;
      })
    : undefined;
  const nextIntervalToday = status.isOpen
    ? undefined
    : todayIntervals.find((interval) => compareTime(currentTime, interval.startTime) === -1);
  // When closed with nothing left to open today, the weekday alone doesn't
  // say whether today is a day off or already closed for the day — keep
  // that distinction visible even while the weekly list stays collapsed.
  const todayClosedDetail = nextIntervalToday
    ? null
    : todayIntervals.length === 0
      ? "выходной"
      : `закрылось в ${todayIntervals[todayIntervals.length - 1].endTime}`;
  const bannerCaption = status.isOpen
    ? [currentInterval ? `до ${currentInterval.endTime}` : null, todayLabel].filter(Boolean).join(", ")
    : [nextIntervalToday ? `откроется в ${nextIntervalToday.startTime}` : null, todayLabel, todayClosedDetail].filter(Boolean).join(", ");

  return (
    <TrackedShell analytics={analytics} icon={<Clock className="h-[18px] w-[18px]" />} title="Режим работы">
      <div>
        <div className={cn("mb-4 flex items-center gap-2.5 rounded-[13px] px-3.5 py-3", status.isOpen ? "bg-success/10" : "bg-surface-hover")}>
          <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", status.isOpen ? "bg-success shadow-[0_0_0_3px_rgba(22,163,74,0.18)]" : "bg-muted-foreground/40")} />
          <b className={cn("text-[14.5px] font-semibold", status.isOpen ? "text-success" : "text-foreground")}>
            {status.isOpen ? "Открыто сейчас" : "Закрыто сейчас"}
          </b>
          {bannerCaption && <span className="text-[13px] text-muted-foreground">· {bannerCaption}</span>}
        </div>

        <OpeningHoursSchedule analytics={analytics}>
          {OPENING_HOURS_DAYS.map((day) => {
            const rule = data.rules.find((item) => item.dayOfWeek === day);
            const isToday = day === todayKey;
            if (!rule && !(isToday && todayException)) return null;

            const effectiveIsOpen = isToday && todayException ? !todayException.isClosed : Boolean(rule?.isOpen);
            const effectiveAllDay = isToday && todayException ? todayException.allDay : Boolean(rule?.allDay);
            const effectiveIntervals = isToday && todayException ? todayException.intervals : (rule?.intervals ?? []);

            return (
              <div key={day} className="flex items-baseline gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                <span className={cn("shrink-0 text-[14.5px] sm:w-[7rem]", isToday ? "font-bold" : "font-medium")}>
                  {DAY[day]}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-brand-soft px-1.5 py-0.5 align-middle font-mono text-[8.5px] font-semibold uppercase tracking-wide text-brand">
                      сегодня
                    </span>
                  )}
                </span>
                <span className="mb-1 h-0 flex-1 border-b border-dotted border-border" />
                <span
                  className={cn(
                    "min-w-0 max-w-[55%] text-right font-mono text-sm sm:max-w-none sm:whitespace-nowrap",
                    !effectiveIsOpen ? "font-normal text-muted-foreground" : isToday ? "font-semibold text-brand" : "font-medium",
                  )}
                >
                  {!effectiveIsOpen ? "выходной" : effectiveAllDay ? "Круглосуточно" : intervals(effectiveIntervals)}
                </span>
              </div>
            );
          })}

          {data.exceptions.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-sm font-medium">Особые даты</p>
              {data.exceptions.map((item) => (
                <div key={item.date} className="flex justify-between gap-3 text-sm">
                  <span>{item.date}</span>
                  <span>{item.isClosed ? "Закрыто" : item.allDay ? "Круглосуточно" : intervals(item.intervals)}</span>
                </div>
              ))}
            </div>
          )}
          {data.note && <p className="mt-3 text-sm text-muted-foreground">{data.note}</p>}
        </OpeningHoursSchedule>
      </div>
    </TrackedShell>
  );
}
