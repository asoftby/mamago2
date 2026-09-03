import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import type { SharedContactsData } from "@/domain/contacts/structuredContacts";
import { formatSharedPrice, type SharedPriceData } from "@/domain/pricing/structuredPrice";
import { OPENING_HOURS_DAYS, type SharedOpeningHoursData } from "@/domain/opening-hours/structuredOpeningHours";

const DAY: Record<(typeof OPENING_HOURS_DAYS)[number], string> = { MON: "Пн", TUE: "Вт", WED: "Ср", THU: "Чт", FRI: "Пт", SAT: "Сб", SUN: "Вс" };
const SOCIAL: Record<SharedContactsData["socials"][number]["kind"], string> = { instagram: "Instagram", telegram: "Telegram", vk: "VK", tiktok: "TikTok", youtube: "YouTube", other: "Ссылка" };

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="not-prose my-8 border-y border-border/60 py-5 font-sans md:my-10 md:py-6"><h2 className="mb-4 font-serif text-xl font-bold tracking-tight md:text-2xl">{title}</h2>{children}</section>;
}
const Row = ({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) => <div className="flex min-w-0 items-start gap-3 text-[15px] leading-6"><span className="mt-1 shrink-0 text-muted-foreground">{icon}</span><span className="min-w-0 break-words">{children}</span></div>;

export function ArticleContactsBlock({ data }: { data: SharedContactsData }) {
  if (!data.address && !data.email && !data.website && !data.mapUrl && data.phones.length === 0 && data.socials.length === 0) return null;
  return <Shell title="Контакты"><div className="space-y-3">
    {data.address && <Row icon={<MapPin className="h-4 w-4" />}>{data.mapUrl ? <a className="underline underline-offset-2" href={data.mapUrl} target="_blank" rel="noreferrer">{data.address}</a> : data.address}</Row>}
    {data.phones.map((phone, index) => <Row key={`${phone.value}-${index}`} icon={<Phone className="h-4 w-4" />}><a className="underline underline-offset-2" href={`tel:${phone.value}`}>{phone.label ? `${phone.label}: ` : ""}{phone.value}</a></Row>)}
    {data.email && <Row icon={<Mail className="h-4 w-4" />}><a className="underline underline-offset-2" href={`mailto:${data.email}`}>{data.email}</a></Row>}
    {data.website && <Row icon={<ExternalLink className="h-4 w-4" />}><a className="break-all underline underline-offset-2" href={data.website} target="_blank" rel="noreferrer">{data.website}</a></Row>}
    {data.socials.map((social, index) => <Row key={`${social.url}-${index}`} icon={<ExternalLink className="h-4 w-4" />}><a className="underline underline-offset-2" href={social.url} target="_blank" rel="noreferrer">{SOCIAL[social.kind]}</a></Row>)}
  </div></Shell>;
}

export function ArticlePriceBlock({ data }: { data: SharedPriceData }) {
  const summary = formatSharedPrice(data);
  if (!summary && data.items.length === 0 && !data.note.trim()) return null;
  return <Shell title="Стоимость"><div className="space-y-3">
    {data.items.length > 0 ? <div className="divide-y divide-border/50">{data.items.map((item) => <div key={item.id} className="flex min-w-0 items-start justify-between gap-4 py-2.5 first:pt-0"><div className="min-w-0"><p className="break-words font-medium">{item.label}</p>{item.description && <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>}</div><p className="shrink-0 whitespace-nowrap font-semibold">{item.price} {item.unit}</p></div>)}</div> : summary ? <p className="text-lg font-semibold">{summary}</p> : null}
    {data.note.trim() && <p className="text-sm text-muted-foreground">{data.note}</p>}
  </div></Shell>;
}

function intervals(items: Array<{ startTime: string; endTime: string }>) { return items.map((item) => `${item.startTime}–${item.endTime}`).join(", "); }
export function ArticleOpeningHoursBlock({ data }: { data: SharedOpeningHoursData }) {
  const hasWeekly = data.rules.some((rule) => rule.isOpen);
  if (data.mode === "WEEKLY" && !hasWeekly && data.exceptions.length === 0 && !data.note) return null;
  const modeLabel = data.mode === "ALWAYS_OPEN" ? "Круглосуточно" : data.mode === "BY_APPOINTMENT" ? "По предварительной записи" : data.mode === "TEMPORARILY_CLOSED" ? "Временно закрыто" : null;
  return <Shell title="Режим работы"><div className="space-y-3">
    {modeLabel ? <p className="font-medium">{modeLabel}</p> : <div className="space-y-1.5">{OPENING_HOURS_DAYS.map((day) => { const rule = data.rules.find((item) => item.dayOfWeek === day); if (!rule) return null; return <div key={day} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 text-[15px]"><span className="text-muted-foreground">{DAY[day]}</span><span>{!rule.isOpen ? "Закрыто" : rule.allDay ? "Круглосуточно" : intervals(rule.intervals)}</span></div>; })}</div>}
    {data.exceptions.length > 0 && <div className="border-t border-border/50 pt-3"><p className="mb-2 text-sm font-medium">Особые даты</p>{data.exceptions.map((item) => <div key={item.date} className="flex justify-between gap-3 text-sm"><span>{item.date}</span><span>{item.isClosed ? "Закрыто" : item.allDay ? "Круглосуточно" : intervals(item.intervals)}</span></div>)}</div>}
    {data.note && <p className="text-sm text-muted-foreground">{data.note}</p>}
  </div></Shell>;
}
