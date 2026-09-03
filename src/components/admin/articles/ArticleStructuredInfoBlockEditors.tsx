"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OpeningHoursEditor } from "@/components/openingHours/OpeningHoursEditor";
import { CONTACT_SOCIAL_KINDS, SharedContactsDataSchema, type SharedContactsData } from "@/domain/contacts/structuredContacts";
import { SharedPriceDataSchema, type SharedPriceData } from "@/domain/pricing/structuredPrice";
import { SharedOpeningHoursDataSchema, type SharedOpeningHoursData } from "@/domain/opening-hours/structuredOpeningHours";
import { randomId } from "@/lib/utils/randomId";

const clean = (value: string) => value.trim() || undefined;
const validationMessage = (value: unknown, schema: { safeParse: (value: unknown) => { success: boolean } }) =>
  schema.safeParse(value).success ? null : "Проверьте заполненные поля: email, ссылки, суммы и время должны быть корректными.";

export function ArticleContactsBlockEditor({ value, onChange }: { value: SharedContactsData; onChange: (value: SharedContactsData) => void }) {
  const error = validationMessage(value, SharedContactsDataSchema);
  return <div className="space-y-4">
    <Field label="Адрес"><Input aria-label="Адрес" value={value.address ?? ""} onChange={(e) => onChange({ ...value, address: clean(e.target.value) })} /></Field>
    <Field label="Телефоны">
      {value.phones.map((phone, index) => <Row key={index}><Input aria-label={`Телефон ${index + 1}`} value={phone.value} onChange={(e) => onChange({ ...value, phones: value.phones.map((item, i) => i === index ? { ...item, value: e.target.value } : item) })} /><Delete onClick={() => onChange({ ...value, phones: value.phones.filter((_, i) => i !== index) })} label="Удалить телефон" /></Row>)}
      <Add onClick={() => onChange({ ...value, phones: [...value.phones, { value: "" }] })}>Добавить телефон</Add>
    </Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Email"><Input aria-label="Email" type="email" value={value.email ?? ""} onChange={(e) => onChange({ ...value, email: clean(e.target.value) })} /></Field><Field label="Сайт"><Input aria-label="Сайт" type="url" value={value.website ?? ""} onChange={(e) => onChange({ ...value, website: clean(e.target.value) })} /></Field></div>
    <Field label="Соцсети">
      {value.socials.map((social, index) => <Row key={index}><Select value={social.kind} onValueChange={(kind) => onChange({ ...value, socials: value.socials.map((item, i) => i === index ? { ...item, kind: kind as typeof social.kind } : item) })}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{CONTACT_SOCIAL_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}</SelectContent></Select><Input type="url" aria-label={`Ссылка соцсети ${index + 1}`} value={social.url} onChange={(e) => onChange({ ...value, socials: value.socials.map((item, i) => i === index ? { ...item, url: e.target.value } : item) })} /><Delete onClick={() => onChange({ ...value, socials: value.socials.filter((_, i) => i !== index) })} label="Удалить ссылку" /></Row>)}
      <Add onClick={() => onChange({ ...value, socials: [...value.socials, { kind: "instagram", url: "" }] })}>Добавить ссылку</Add>
    </Field>
    <Field label="Ссылка на карту"><Input aria-label="Ссылка на карту" type="url" value={value.mapUrl ?? ""} onChange={(e) => onChange({ ...value, mapUrl: clean(e.target.value) })} /></Field>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}

const PRICE_LABELS: Record<SharedPriceData["mode"], string> = { FREE: "Бесплатно", EXACT: "Точная", FROM: "От", RANGE: "Диапазон", NONE: "Не применяется", UNKNOWN: "Не указана" };
export function priceForMode(value: SharedPriceData, mode: SharedPriceData["mode"]): SharedPriceData {
  const base = { ...value, mode };
  if (mode === "FREE") return { ...base, min: 0, max: 0 };
  if (mode === "EXACT") return { ...base, min: value.min ?? 0, max: value.min ?? 0 };
  if (mode === "FROM") return { ...base, min: value.min ?? 0, max: null };
  if (mode === "RANGE") return { ...base, min: value.min ?? 0, max: value.max ?? value.min ?? 0 };
  return { ...base, min: null, max: null };
}

export function ArticlePriceBlockEditor({ value, onChange }: { value: SharedPriceData; onChange: (value: SharedPriceData) => void }) {
  const updateAmount = (key: "min" | "max", raw: string) => { const amount = raw === "" ? null : Number(raw); const next = { ...value, [key]: Number.isFinite(amount) ? amount : null }; onChange(next.mode === "EXACT" ? { ...next, min: next.min, max: next.min } : next); };
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Тип цены"><Select value={value.mode} onValueChange={(mode) => onChange(priceForMode(value, mode as SharedPriceData["mode"]))}><SelectTrigger aria-label="Тип цены"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRICE_LABELS).map(([mode, label]) => <SelectItem key={mode} value={mode}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label="Валюта"><Input aria-label="Валюта" value={value.currency} onChange={(e) => onChange({ ...value, currency: e.target.value })} /></Field></div>
    {(value.mode === "EXACT" || value.mode === "FROM" || value.mode === "RANGE") && <div className="grid gap-3 sm:grid-cols-2"><Field label={value.mode === "RANGE" ? "От" : "Сумма"}><Input aria-label={value.mode === "RANGE" ? "Цена от" : "Сумма"} type="number" min="0" value={value.min ?? ""} onChange={(e) => updateAmount("min", e.target.value)} /></Field>{value.mode === "RANGE" && <Field label="До"><Input aria-label="Цена до" type="number" min="0" value={value.max ?? ""} onChange={(e) => updateAmount("max", e.target.value)} /></Field>}</div>}
    <Field label="Варианты">
      {value.items.map((item, index) => <Row key={item.id}><Input aria-label={`Название варианта ${index + 1}`} placeholder="Детский билет" value={item.label} onChange={(e) => onChange({ ...value, items: value.items.map((row, i) => i === index ? { ...row, label: e.target.value } : row) })} /><Input className="w-28" aria-label={`Цена варианта ${index + 1}`} placeholder="15" value={item.price} onChange={(e) => onChange({ ...value, items: value.items.map((row, i) => i === index ? { ...row, price: e.target.value } : row) })} /><Delete label="Удалить вариант" onClick={() => onChange({ ...value, items: value.items.filter((_, i) => i !== index) })} /></Row>)}
      <Add onClick={() => onChange({ ...value, items: [...value.items, { id: randomId(), label: "", price: "", unit: value.currency }] })}>Добавить вариант</Add>
    </Field>
    <Field label="Примечание"><Textarea aria-label="Примечание к стоимости" value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} /></Field>
    {validationMessage(value, SharedPriceDataSchema) && <p role="alert" className="text-xs text-destructive">Проверьте суммы и заполнение вариантов стоимости.</p>}
  </div>;
}

export function ArticleOpeningHoursBlockEditor({ value, onChange }: { value: SharedOpeningHoursData; onChange: (value: SharedOpeningHoursData) => void }) {
  return <div className="space-y-4"><OpeningHoursEditor value={{ mode: value.mode, timezone: value.timezone, note: value.note, rules: value.rules }} onChange={(next) => onChange({ ...value, ...next })} timezone={value.timezone} />
    <Field label="Часовой пояс"><Input aria-label="Часовой пояс" value={value.timezone} onChange={(e) => onChange({ ...value, timezone: e.target.value })} /></Field>
    <Field label="Исключения"><p className="text-xs text-muted-foreground">Закрытая дата, круглосуточная работа или особые интервалы.</p>{value.exceptions.map((exception, index) => <div className="space-y-2 rounded-md border p-3" key={`${index}`}><Row><Input type="date" aria-label={`Дата исключения ${index + 1}`} value={exception.date} onChange={(e) => onChange({ ...value, exceptions: value.exceptions.map((item, i) => i === index ? { ...item, date: e.target.value } : item) })} /><Select value={exception.isClosed ? "closed" : exception.allDay ? "allDay" : "interval"} onValueChange={(kind) => onChange({ ...value, exceptions: value.exceptions.map((item, i) => i !== index ? item : kind === "closed" ? { ...item, isClosed: true, allDay: false, intervals: [] } : kind === "allDay" ? { ...item, isClosed: false, allDay: true, intervals: [] } : { ...item, isClosed: false, allDay: false, intervals: item.intervals.length ? item.intervals : [{ startTime: "09:00", endTime: "18:00" }] }) })}><SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="closed">Закрыто</SelectItem><SelectItem value="allDay">Круглосуточно</SelectItem><SelectItem value="interval">Особые часы</SelectItem></SelectContent></Select><Delete label="Удалить исключение" onClick={() => onChange({ ...value, exceptions: value.exceptions.filter((_, i) => i !== index) })} /></Row>{!exception.isClosed && !exception.allDay && <div className="space-y-2">{exception.intervals.map((interval, intervalIndex) => <Row key={intervalIndex}><Input type="time" aria-label={`Начало особого интервала ${intervalIndex + 1}`} value={interval.startTime} onChange={(e) => onChange({ ...value, exceptions: value.exceptions.map((item, i) => i === index ? { ...item, intervals: item.intervals.map((part, j) => j === intervalIndex ? { ...part, startTime: e.target.value } : part) } : item) })} /><Input type="time" aria-label={`Конец особого интервала ${intervalIndex + 1}`} value={interval.endTime} onChange={(e) => onChange({ ...value, exceptions: value.exceptions.map((item, i) => i === index ? { ...item, intervals: item.intervals.map((part, j) => j === intervalIndex ? { ...part, endTime: e.target.value } : part) } : item) })} /><Delete label="Удалить особый интервал" onClick={() => onChange({ ...value, exceptions: value.exceptions.map((item, i) => i === index ? { ...item, intervals: item.intervals.filter((_, j) => j !== intervalIndex) } : item) })} /></Row>)}<Add onClick={() => onChange({ ...value, exceptions: value.exceptions.map((item, i) => i === index ? { ...item, intervals: [...item.intervals, { startTime: "09:00", endTime: "18:00" }] } : item) })}>Добавить интервал</Add></div>}<Input aria-label="Примечание к особой дате" placeholder="Примечание" value={exception.note ?? ""} onChange={(e) => onChange({ ...value, exceptions: value.exceptions.map((item, i) => i === index ? { ...item, note: clean(e.target.value) } : item) })} /></div>)}<Add onClick={() => onChange({ ...value, exceptions: [...value.exceptions, { date: "", isClosed: true, allDay: false, intervals: [] }] })}>Добавить особую дату</Add></Field>
    {validationMessage(value, SharedOpeningHoursDataSchema) && <p role="alert" className="text-xs text-destructive">Проверьте часовой пояс, даты и интервалы режима работы.</p>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Row({ children }: { children: React.ReactNode }) { return <div className="flex min-w-0 flex-col gap-2 sm:flex-row">{children}</div>; }
function Add({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onClick}><Plus className="h-4 w-4" />{children}</Button>; }
function Delete({ onClick, label }: { onClick: () => void; label: string }) { return <Button type="button" size="icon" variant="ghost" aria-label={label} onClick={onClick}><Trash2 className="h-4 w-4" /></Button>; }
