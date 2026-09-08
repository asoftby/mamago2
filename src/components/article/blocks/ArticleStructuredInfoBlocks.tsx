import type { ComponentType, ReactNode } from "react";
import {
  Banknote,
  Clock,
  ExternalLink,
  Info,
  Instagram,
  Mail,
  Map as MapIcon,
  MapPin,
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

export function ArticleContactsBlock({ data }: { data: SharedContactsData }) {
  const mapHref = contactMapHref(data);
  if (!data.address && !data.email && !data.website && !mapHref && data.phones.length === 0 && data.socials.length === 0) return null;
  return (
    <Shell icon={<Phone className="h-[18px] w-[18px]" />} title="Контакты">
      <div>
        {data.address && (
          <Row
            label="Адрес"
            action={
              <>
                {data.coordinates && <CopyCoordinatesButton value={`${data.coordinates.latitude}, ${data.coordinates.longitude}`} />}
                {mapHref && (
                  <a href={mapHref} target="_blank" rel="noreferrer" className={pill}>
                    <MapIcon className="h-3.5 w-3.5" />Маршрут
                  </a>
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
            <a className="underline underline-offset-2" href={mapHref} target="_blank" rel="noreferrer">Открыть на карте</a>
          </Row>
        )}
        {data.phones.map((phone, index) => (
          <Row
            key={`${phone.value}-${index}`}
            label={phone.label || "Телефон"}
            action={
              <a href={`tel:${phone.value}`} className={pillPrimary}>
                <Phone className="h-3.5 w-3.5" />Позвонить
              </a>
            }
          >
            <span className="font-mono text-[14.5px]">{phone.value}</span>
          </Row>
        ))}
        {data.email && (
          <Row
            label="Почта"
            action={
              <a href={`mailto:${data.email}`} className={pill}>
                <Mail className="h-3.5 w-3.5" />Написать
              </a>
            }
          >
            <span className="font-mono text-[14.5px]">{data.email}</span>
          </Row>
        )}
        {data.website && (
          <Row label="Сайт">
            <a href={data.website} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 break-all font-semibold text-brand">
              {data.website}<ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </Row>
        )}
        {data.socials.length > 0 && (
          <Row label="Соцсети">
            <span className="flex flex-wrap gap-1.5">
              {data.socials.map((social, index) => {
                const Icon = SOCIAL_ICON[social.kind];
                return (
                  <a
                    key={`${social.url}-${index}`}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    title={SOCIAL_LABEL[social.kind]}
                    aria-label={SOCIAL_LABEL[social.kind]}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:border-foreground hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </span>
          </Row>
        )}
      </div>
    </Shell>
  );
}

function pluralizeItems(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "позиция";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "позиции";
  return "позиций";
}

export function ArticlePriceBlock({ data }: { data: SharedPriceData }) {
  const summary = formatSharedPrice(data);
  if (!summary && data.items.length === 0 && !data.note.trim()) return null;
  return (
    <Shell
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
    </Shell>
  );
}

function intervals(items: Array<{ startTime: string; endTime: string }>) {
  return items.map((item) => `${item.startTime}–${item.endTime}`).join(", ");
}

function todaysDayKey(timezone: string, now: Date): (typeof OPENING_HOURS_DAYS)[number] {
  const jsDay = getDayOfWeekInTimezone(now, timezone) as keyof typeof JS_DAY_TO_DAY_OF_WEEK;
  return JS_DAY_TO_DAY_OF_WEEK[jsDay];
}

type WeeklyStatusSummary = {
  isOpen: boolean;
  caption: string;
  todayKey: (typeof OPENING_HOURS_DAYS)[number];
  todayException: SharedOpeningHoursData["exceptions"][number] | undefined;
};

function weeklyStatusSummary(data: SharedOpeningHoursData, now: Date): WeeklyStatusSummary {
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
  const caption = status.isOpen
    ? [currentInterval ? `до ${currentInterval.endTime}` : null, todayLabel].filter(Boolean).join(", ")
    : [nextIntervalToday ? `откроется в ${nextIntervalToday.startTime}` : null, todayLabel, todayClosedDetail].filter(Boolean).join(", ");
  return { isOpen: status.isOpen, caption, todayKey, todayException };
}

type WeeklyDayRow = {
  day: (typeof OPENING_HOURS_DAYS)[number];
  isToday: boolean;
  isOpen: boolean;
  allDay: boolean;
  intervals: Array<{ startTime: string; endTime: string }>;
};

function weeklyDayRows(
  data: SharedOpeningHoursData,
  todayKey: (typeof OPENING_HOURS_DAYS)[number],
  todayException: SharedOpeningHoursData["exceptions"][number] | undefined,
): WeeklyDayRow[] {
  return OPENING_HOURS_DAYS.flatMap((day) => {
    const rule = data.rules.find((item) => item.dayOfWeek === day);
    const isToday = day === todayKey;
    if (!rule && !(isToday && todayException)) return [];
    return [
      {
        day,
        isToday,
        isOpen: isToday && todayException ? !todayException.isClosed : Boolean(rule?.isOpen),
        allDay: isToday && todayException ? todayException.allDay : Boolean(rule?.allDay),
        intervals: isToday && todayException ? todayException.intervals : (rule?.intervals ?? []),
      },
    ];
  });
}

export function ArticleOpeningHoursBlock({ data }: { data: SharedOpeningHoursData }) {
  const hasWeekly = data.rules.some((rule) => rule.isOpen);
  if (data.mode === "WEEKLY" && !hasWeekly && data.exceptions.length === 0 && !data.note) return null;

  if (data.mode !== "WEEKLY") {
    const modeLabel = data.mode === "ALWAYS_OPEN" ? "Круглосуточно" : data.mode === "BY_APPOINTMENT" ? "По предварительной записи" : "Временно закрыто";
    return (
      <Shell icon={<Clock className="h-[18px] w-[18px]" />} title="Режим работы">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Clock className="h-[22px] w-[22px]" />
          </span>
          <span>
            <span className="block font-serif text-2xl tracking-tight">{modeLabel}</span>
            {data.note && <span className="mt-1 block text-sm text-muted-foreground">{data.note}</span>}
          </span>
        </div>
      </Shell>
    );
  }

  const now = new Date();
  const { isOpen, caption: bannerCaption, todayKey, todayException } = weeklyStatusSummary(data, now);

  return (
    <Shell icon={<Clock className="h-[18px] w-[18px]" />} title="Режим работы">
      <div>
        <div className={cn("mb-4 flex items-center gap-2.5 rounded-[13px] px-3.5 py-3", isOpen ? "bg-success/10" : "bg-surface-hover")}>
          <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", isOpen ? "bg-success shadow-[0_0_0_3px_rgba(22,163,74,0.18)]" : "bg-muted-foreground/40")} />
          <b className={cn("text-[14.5px] font-semibold", isOpen ? "text-success" : "text-foreground")}>
            {isOpen ? "Открыто сейчас" : "Закрыто сейчас"}
          </b>
          {bannerCaption && <span className="text-[13px] text-muted-foreground">· {bannerCaption}</span>}
        </div>

        <OpeningHoursSchedule>
          {weeklyDayRows(data, todayKey, todayException).map((row) => (
            <div key={row.day} className="flex items-baseline gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
              <span className={cn("shrink-0 text-[14.5px] sm:w-[7rem]", row.isToday ? "font-bold" : "font-medium")}>
                {DAY[row.day]}
                {row.isToday && (
                  <span className="ml-2 rounded-full bg-brand-soft px-1.5 py-0.5 align-middle font-mono text-[8.5px] font-semibold uppercase tracking-wide text-brand">
                    сегодня
                  </span>
                )}
              </span>
              <span className="mb-1 h-0 flex-1 border-b border-dotted border-border" />
              <span
                className={cn(
                  "min-w-0 max-w-[55%] text-right font-mono text-sm sm:max-w-none sm:whitespace-nowrap",
                  !row.isOpen ? "font-normal text-muted-foreground" : row.isToday ? "font-semibold text-brand" : "font-medium",
                )}
              >
                {!row.isOpen ? "выходной" : row.allDay ? "Круглосуточно" : intervals(row.intervals)}
              </span>
            </div>
          ))}

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
    </Shell>
  );
}

function isContactsDataEmpty(data: SharedContactsData | undefined): boolean {
  if (!data) return true;
  return !data.address && !data.email && !data.website && !contactMapHref(data) && data.phones.length === 0 && data.socials.length === 0;
}

function isPriceDataEmpty(data: SharedPriceData | undefined): boolean {
  if (!data) return true;
  return !formatSharedPrice(data) && data.items.length === 0 && !data.note.trim();
}

function isOpeningHoursDataEmpty(data: SharedOpeningHoursData | undefined): boolean {
  if (!data) return true;
  return data.mode === "WEEKLY" && !data.rules.some((rule) => rule.isOpen) && data.exceptions.length === 0 && !data.note;
}

/**
 * Contacts, price and openingHours are authored as three independent blocks
 * (see articleMvp.ts), but when they land next to each other in the article
 * body they read as one fact sheet about the same place — so they render as
 * a single merged card instead of three stacked Shells. Any section (or two)
 * can be missing; the remaining ones simply take the freed-up space.
 */
export function ArticleInfoCard({
  contacts,
  price,
  openingHours,
}: {
  contacts?: SharedContactsData;
  price?: SharedPriceData;
  openingHours?: SharedOpeningHoursData;
}) {
  const hasContacts = !isContactsDataEmpty(contacts);
  const hasPrice = !isPriceDataEmpty(price);
  const hasHours = !isOpeningHoursDataEmpty(openingHours);
  if (!hasContacts && !hasPrice && !hasHours) return null;

  const priceSummary = hasPrice && price ? formatSharedPrice(price) : null;

  let statusNode: ReactNode = null;
  if (hasHours && openingHours) {
    if (openingHours.mode !== "WEEKLY") {
      const modeLabel =
        openingHours.mode === "ALWAYS_OPEN"
          ? "Круглосуточно"
          : openingHours.mode === "BY_APPOINTMENT"
            ? "По предварительной записи"
            : "Временно закрыто";
      statusNode = <b className="text-[13.5px] font-semibold text-foreground">{modeLabel}</b>;
    } else {
      const { isOpen, caption } = weeklyStatusSummary(openingHours, new Date());
      statusNode = (
        <>
          <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", isOpen ? "bg-success shadow-[0_0_0_3px_rgba(22,163,74,0.18)]" : "bg-muted-foreground/40")} />
          <b className={cn("text-[13.5px] font-semibold", isOpen ? "text-success" : "text-foreground")}>
            {isOpen ? "Открыто сейчас" : "Закрыто сейчас"}
          </b>
          {caption && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span className="text-[13px] text-muted-foreground">{caption}</span>
            </>
          )}
        </>
      );
    }
  }

  const mapHref = hasContacts && contacts ? contactMapHref(contacts) : null;
  const hasAddressBand = hasContacts && contacts && Boolean(contacts.address || mapHref);
  const hasPhonesBand = hasContacts && contacts && contacts.phones.length > 0;
  const hasLinksBand = hasContacts && contacts && Boolean(contacts.website || contacts.email || contacts.socials.length > 0);

  return (
    <section className="not-prose my-8 overflow-hidden rounded-2xl border border-border bg-surface-subtle shadow-sm md:my-10">
      {(statusNode || priceSummary) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3 md:px-6">
          {statusNode}
          {priceSummary && (
            <span className={cn("ml-auto whitespace-nowrap font-mono text-[13px] font-semibold", price?.mode === "FREE" && "text-success")}>
              {renderCurrencyText(normalizeUiCurrencyText(priceSummary), { iconSize: "sm" })}
            </span>
          )}
        </div>
      )}

      {(hasHours || hasPrice) && (
        <div className={cn("grid grid-cols-1", hasHours && hasPrice && "sm:grid-cols-2")}>
          {hasHours && openingHours && (
            <div className={cn("p-5 md:p-6", hasPrice && "border-b border-border sm:border-b-0 sm:border-r")}>
              <div className="mb-3 font-mono text-[9.5px] uppercase tracking-[0.13em] text-muted-foreground">Режим работы</div>
              {openingHours.mode === "WEEKLY" ? (
                (() => {
                  const { todayKey, todayException } = weeklyStatusSummary(openingHours, new Date());
                  return (
                    <div>
                      {weeklyDayRows(openingHours, todayKey, todayException).map((row) => (
                        <div key={row.day} className="flex items-baseline gap-3 border-t border-border py-2 first:border-t-0 first:pt-0">
                          <span className={cn("shrink-0 text-[13.5px]", row.isToday ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                            {DAY[row.day]}
                          </span>
                          <span className="mb-1 h-0 flex-1 border-b border-dotted border-border" />
                          <span
                            className={cn(
                              "min-w-0 max-w-[55%] text-right font-mono text-[13px] sm:max-w-none sm:whitespace-nowrap",
                              !row.isOpen ? "font-normal text-muted-foreground" : row.isToday ? "font-semibold text-brand" : "font-medium",
                            )}
                          >
                            {!row.isOpen ? "выходной" : row.allDay ? "Круглосуточно" : intervals(row.intervals)}
                          </span>
                        </div>
                      ))}
                      {openingHours.exceptions.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Особые даты</p>
                          {openingHours.exceptions.map((item) => (
                            <div key={item.date} className="flex justify-between gap-3 text-xs">
                              <span>{item.date}</span>
                              <span>{item.isClosed ? "Закрыто" : item.allDay ? "Круглосуточно" : intervals(item.intervals)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {openingHours.note && <p className="mt-3 text-xs text-muted-foreground">{openingHours.note}</p>}
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Clock className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif text-xl tracking-tight">
                      {openingHours.mode === "ALWAYS_OPEN" ? "Круглосуточно" : openingHours.mode === "BY_APPOINTMENT" ? "По записи" : "Временно закрыто"}
                    </span>
                    {openingHours.note && <span className="mt-0.5 block text-xs text-muted-foreground">{openingHours.note}</span>}
                  </span>
                </div>
              )}
            </div>
          )}
          {hasPrice && price && (
            <div className="p-5 md:p-6">
              <div className="mb-3 flex items-center justify-between gap-2 font-mono text-[9.5px] uppercase tracking-[0.13em] text-muted-foreground">
                <span>Стоимость</span>
                {price.items.length > 0 && <span className="whitespace-nowrap">{price.items.length} {pluralizeItems(price.items.length)}</span>}
              </div>
              {price.items.length > 0 ? (
                price.items.map((item) => (
                  <div key={item.id} className="flex items-baseline gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                    <span className="min-w-0">
                      <span className="text-[14px] font-medium">{item.label}</span>
                      {item.description && <small className="mt-0.5 block text-[11px] text-muted-foreground">{item.description}</small>}
                    </span>
                    <span className="mb-1 h-0 flex-1 border-b border-dotted border-border" />
                    <span
                      className={cn(
                        "whitespace-nowrap font-mono text-[13.5px] font-semibold",
                        /бесплатно|free/i.test(item.price) && "text-success",
                      )}
                    >
                      {item.price}
                      {item.unit && (
                        <em className="ml-1 text-[10.5px] font-normal not-italic text-muted-foreground">
                          {renderCurrencyText(normalizeUiCurrencyText(item.unit), { iconSize: "sm" })}
                        </em>
                      )}
                    </span>
                  </div>
                ))
              ) : priceSummary ? (
                <p className={cn("text-base font-semibold", price.mode === "FREE" && "text-success")}>
                  {renderCurrencyText(priceSummary, { iconSize: "text" })}
                </p>
              ) : null}
              {price.note.trim() && (
                <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" />{price.note}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {hasAddressBand && contacts && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3.5 md:px-6">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[14.5px]">
            <MapPin className="h-4 w-4 shrink-0 text-brand" />
            {contacts.address ? (
              <span className="min-w-0">
                <span className="font-semibold">{contacts.address}</span>
                {contacts.coordinates && (
                  <small className="ml-2 font-mono text-xs text-muted-foreground">
                    {contacts.coordinates.latitude}, {contacts.coordinates.longitude}
                  </small>
                )}
              </span>
            ) : (
              <a className="underline underline-offset-2" href={mapHref ?? undefined} target="_blank" rel="noreferrer">
                Открыть на карте
              </a>
            )}
          </span>
          <span className="flex shrink-0 flex-wrap items-center gap-2">
            {contacts.coordinates && <CopyCoordinatesButton value={`${contacts.coordinates.latitude}, ${contacts.coordinates.longitude}`} />}
            {mapHref && (
              <a href={mapHref} target="_blank" rel="noreferrer" className={pill}>
                <MapIcon className="h-3.5 w-3.5" />Маршрут
              </a>
            )}
          </span>
        </div>
      )}

      {hasPhonesBand && contacts && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3 md:px-6">
          <span className="mr-1 font-mono text-[9.5px] uppercase tracking-[0.13em] text-muted-foreground">Телефоны</span>
          {contacts.phones.map((phone, index) => (
            <a
              key={`${phone.value}-${index}`}
              href={`tel:${phone.value}`}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 font-mono text-[13px] font-medium text-foreground transition-colors hover:border-foreground/40"
            >
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {phone.value}
              {phone.label && <span className="text-[11px] font-sans font-normal text-muted-foreground">{phone.label}</span>}
            </a>
          ))}
        </div>
      )}

      {hasLinksBand && contacts && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 md:px-6">
          {contacts.website && (
            <a href={contacts.website} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 break-all text-[14px] font-semibold text-brand">
              {contacts.website}<ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          )}
          {contacts.email && (
            <a href={`mailto:${contacts.email}`} className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground">
              {contacts.email}
            </a>
          )}
          {contacts.socials.length > 0 && (
            <span className="ml-auto flex flex-wrap gap-1.5">
              {contacts.socials.map((social, index) => {
                const Icon = SOCIAL_ICON[social.kind];
                return (
                  <a
                    key={`${social.url}-${index}`}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    title={SOCIAL_LABEL[social.kind]}
                    aria-label={SOCIAL_LABEL[social.kind]}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:border-foreground hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
