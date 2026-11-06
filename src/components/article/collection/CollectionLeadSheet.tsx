"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, CalendarDays } from "lucide-react";
import { PhoneInputByMask } from "@/components/phone/PhoneInputByMask";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { cn } from "@/lib/utils";
import { CollectionLeadError, submitCollectionLead, type CollectionLeadProgress } from "@/lib/article/collectionLeadApi";
import {
  clampChildren, clearLeadDraft, earliestLeadDate, initialLeadForm, loadLeadDraft, saveLeadDraft, suggestLeadDates,
  validateLeadForm, withLeadReturnParam, type CollectionLeadErrors, type CollectionLeadForm,
} from "@/lib/article/collectionLeadForm";
import { ageMonthsFromBirthDate, ageYears } from "@/lib/article/collectionPersonalOrder";
import type { ResolvedOfferEmbedCard } from "@/lib/article/articleMvpRenderData";

type Props = {
  card: ResolvedOfferEmbedCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const AGE_OPTIONS = Array.from({ length: 15 }, (_, i) => i);
const field = "min-h-12 w-full rounded-2xl border border-[rgba(20,18,16,.18)] bg-white px-4 text-base text-[#141210] focus:border-[#141210] focus:outline-none";

/** Воронка заявки из подборки: открыл лист → отправить → вход → заявка создана. */
function track(card: ResolvedOfferEmbedCard, step: "open" | "submit" | "created" | "resume") {
  void postAnalyticsEvent({
    eventType: "CTA_CLICK",
    entityType: "OFFER",
    entityId: card.offerId,
    citySlug: card.party?.citySlug ?? null,
    meta: { targetAction: `collection_lead_${step}`, source: "detail", section: "journal" },
  });
}

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[rgba(20,18,16,.18)] bg-white p-0.5">
      <button type="button" aria-label={`${label}: меньше`} disabled={value <= min} onClick={() => onChange(value - 1)} className="flex size-11 items-center justify-center rounded-full hover:bg-[#F6F2EA] disabled:cursor-not-allowed disabled:text-[#B4ABA0]">
        <Minus className="size-[18px]" />
      </button>
      <b aria-live="polite" className="min-w-7 text-center text-lg">{value}</b>
      <button type="button" aria-label={`${label}: больше`} disabled={value >= max} onClick={() => onChange(value + 1)} className="flex size-11 items-center justify-center rounded-full hover:bg-[#F6F2EA] disabled:cursor-not-allowed disabled:text-[#B4ABA0]">
        <Plus className="size-[18px]" />
      </button>
    </div>
  );
}

function Row({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="pt-4">
      <label className="mb-2 block text-sm font-bold text-[#141210]">{label}</label>
      {children}
      {hint && !error ? <p className="m-0 mt-1.5 text-[13px] text-[#6B6259]">{hint}</p> : null}
      {error ? <p role="alert" className="m-0 mt-1.5 text-[13px] font-semibold text-[#C0392B]">{error}</p> : null}
    </div>
  );
}

export function CollectionLeadSheet({ card, open, onOpenChange }: Props) {
  const party = card.party;
  const limits = useMemo(() => ({ minChildren: party?.minChildren ?? null, maxChildren: party?.maxChildren ?? null }), [party]);
  const { isAuthenticated, isLoading } = useAuthMe();
  const persona = useFamilyPersona();
  const adultName = persona?.personas.find((p) => p.kind === "adult")?.displayName ?? "";

  const [form, setForm] = useState<CollectionLeadForm>(() => initialLeadForm(limits));
  const [errors, setErrors] = useState<CollectionLeadErrors>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ partyId: string; date: string } | null>(null);
  const [anyDate, setAnyDate] = useState(false);
  const [planState, setPlanState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const progress = useRef<CollectionLeadProgress>({ idempotencyKey: "" });
  const wasOpen = useRef(false);

  // При каждом открытии: восстановить сохранённую форму (возврат после входа) или взять значения по умолчанию.
  useEffect(() => {
    if (!open || wasOpen.current) {
      wasOpen.current = open;
      return;
    }
    wasOpen.current = true;
    const restored = loadLeadDraft(card.offerId);
    setForm(restored ? initialLeadForm(limits, restored) : initialLeadForm(limits, { contactName: adultName }));
    setErrors({});
    setServerError(null);
    setSent(null);
    setPlanState("idle");
    setAnyDate(false);
    progress.current = { idempotencyKey: `cl_${crypto.randomUUID().replace(/-/g, "")}` };
    track(card, restored ? "resume" : "open");
  }, [open, card, limits, adultName]);

  if (!party) return null;
  const set = <K extends keyof CollectionLeadForm>(key: K, value: CollectionLeadForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const dateChips = suggestLeadDates();
  const familyKids = (persona?.personas ?? []).flatMap((x) => {
    if (x.kind !== "child") return [];
    const months = ageMonthsFromBirthDate(x.birthDate);
    return months == null ? [] : [{ id: x.id, name: x.displayName, age: Math.min(ageYears(months), 14) }];
  });
  const pickKid = (kid: { id: string; name: string; age: number } | null) =>
    setForm((f) => ({ ...f, childName: kid && f.childName !== kid.name ? kid.name : "", childAge: kid && f.childName !== kid.name ? kid.age : f.childAge }));
  const addToPlan = async () => {
    if (!sent) return;
    setPlanState("saving");
    try {
      const res = await fetch("/api/save/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ offerId: card.offerId, date: sent.date, title: card.title, coverImageUrl: card.imageUrl }),
      });
      setPlanState(res.ok ? "done" : "error");
    } catch {
      setPlanState("error");
    }
  };
  const minChildren = Math.max(1, limits.minChildren ?? 1);
  const maxChildren = Math.max(minChildren, limits.maxChildren ?? 500);

  const goToLogin = () => {
    saveLeadDraft(card.offerId, form);
    void postAnalyticsEvent({ eventType: "AUTH_STARTED", entityType: "OFFER", entityId: card.offerId, meta: { source: "detail", section: "journal", targetAction: "collection_lead" } });
    const back = withLeadReturnParam(`${window.location.pathname}${window.location.search}${window.location.hash}`, card.offerId);
    window.location.assign(buildAuthUrl({ redirectTo: back }));
  };

  const onSubmit = async () => {
    const found = validateLeadForm(form, limits);
    setErrors(found);
    if (Object.keys(found).length) return;
    track(card, "submit");
    if (!isAuthenticated) {
      goToLogin();
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      const res = await submitCollectionLead({ offerId: card.offerId, citySlug: party.citySlug, mode: party.mode, form, progress: progress.current });
      clearLeadDraft(card.offerId);
      track(card, "created");
      setSent({ partyId: res.partyId, date: form.eventDate });
    } catch (e) {
      if (e instanceof CollectionLeadError && e.status === 401) {
        goToLogin();
        return;
      }
      setServerError(e instanceof Error ? e.message : "Не удалось отправить заявку");
    } finally {
      setBusy(false);
    }
  };

  const footer = sent ? (
    <button type="button" onClick={() => onOpenChange(false)} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[rgba(20,18,16,.18)] text-[15px] font-semibold">
      Вернуться к подборке
    </button>
  ) : (
    <div>
      <button type="button" disabled={busy || isLoading} onClick={onSubmit} className="inline-flex min-h-[54px] w-full items-center justify-center rounded-full bg-[#E86A3A] text-base font-semibold text-white hover:bg-[#C24E22] disabled:cursor-not-allowed disabled:bg-[#E4DDD2] disabled:text-[#6B6259]">
        {busy ? "Отправляем…" : isAuthenticated ? "Отправить заявку" : "Продолжить"}
      </button>
      <p className="m-0 mt-2 text-center text-[12.5px] text-[#6B6259]">
        {isAuthenticated ? "Это ещё не бронь — площадка уточнит детали и цену." : "Для отправки понадобится войти — введённые данные сохранятся."}
      </p>
    </div>
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Оставить заявку"
      title={sent ? "Заявка отправлена" : "Оставить заявку"}
      subtitle={card.title}
      footer={footer}
      bodyClassName="overflow-y-auto"
    >
      {sent ? (
        <div className="flex flex-col items-center px-4 pb-6 pt-8 text-center sm:px-5">
          <span className="flex size-16 items-center justify-center rounded-full bg-[#FFE8DC] text-[#C24E22]">
            <Check className="size-8" strokeWidth={2.4} />
          </span>
          <h3 className="mb-2 mt-4 font-serif text-[30px] font-normal leading-none">Заявка отправлена</h3>
          <p className="m-0 max-w-[320px] text-[15px] text-[#3A332B]">{`${card.placeName ?? "Площадка"} пришлёт предложение с ценой и условиями — оно появится в вашей заявке. Телефон площадка увидит только после того, как вы подтвердите праздник.`}</p>
          <div className="mt-5 w-full rounded-[20px] bg-[#FFE8DC] p-4 text-left">
            <b className="block text-base text-[#5E2A0E]">Добавить в «Мой план»?</b>
            <span className="mt-1 block text-[13.5px] leading-snug text-[#6E3A1E]">Поставим праздник на выбранную дату, чтобы он не потерялся. Ответ площадки придёт в вашу заявку.</span>
            {planState === "done" ? (
              <Link href="/me/plan" className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#E86A3A] text-[15px] font-semibold !text-white !no-underline">
                <Check className="size-4" aria-hidden="true" /> В плане · открыть
              </Link>
            ) : (
              <button type="button" onClick={addToPlan} disabled={planState === "saving"} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#E86A3A] text-[15px] font-semibold text-white hover:bg-[#C24E22] disabled:opacity-60">
                <Plus className="size-4" aria-hidden="true" /> {planState === "saving" ? "Добавляем…" : "Добавить в план"}
              </button>
            )}
            {planState === "error" ? <span role="alert" className="mt-2 block text-[13px] font-semibold text-[#8C2A20]">Не удалось добавить в план. Заявка при этом отправлена.</span> : null}
          </div>
          <Link href={`/me/birthdays/${sent.partyId}`} className="mt-3 inline-flex min-h-12 items-center rounded-full border border-[rgba(20,18,16,.18)] px-6 text-[15px] font-semibold !text-[#141210] !no-underline hover:border-[#141210]">
            Открыть мою заявку
          </Link>
        </div>
      ) : (
        <div className="overflow-y-auto px-4 pb-4 sm:px-5">
          <Row label="Дата праздника" error={errors.eventDate}>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
              {dateChips.map((c) => (
                <button
                  key={c.iso}
                  type="button"
                  aria-pressed={form.eventDate === c.iso}
                  aria-label={`${c.weekday}, ${c.day} ${c.month}`}
                  onClick={() => { set("eventDate", c.iso); setAnyDate(false); }}
                  className={cn("flex h-[88px] w-[68px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border", form.eventDate === c.iso ? "border-[#141210] bg-[#141210] text-white" : "border-[#ECE6DD] bg-white hover:border-[#DCD4C9]")}
                >
                  <span className={cn("font-mono text-[11px] uppercase tracking-[.14em]", form.eventDate === c.iso ? "text-white/70" : "text-[#6B6259]")}>{c.weekday}</span>
                  <b className="font-serif text-[30px] font-normal leading-none">{c.day}</b>
                  <span className={cn("font-mono text-[10px] uppercase tracking-[.12em]", form.eventDate === c.iso ? "text-white/70" : "text-[#6B6259]")}>{c.month}</span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={anyDate}
                onClick={() => setAnyDate((v) => !v)}
                className={cn("flex h-[88px] w-[68px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed text-[#3A332B]", anyDate ? "border-[#141210]" : "border-[#DCD4C9]")}
              >
                <CalendarDays className="size-5" aria-hidden="true" />
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-[#6B6259]">другая</span>
              </button>
            </div>
            {anyDate || (form.eventDate && !dateChips.some((c) => c.iso === form.eventDate)) ? (
              <input type="date" className={cn(field, "mt-2")} value={form.eventDate} min={earliestLeadDate()} onChange={(e) => set("eventDate", e.target.value)} aria-invalid={!!errors.eventDate} aria-label="Другая дата" />
            ) : null}
          </Row>
          <Row label="Время" error={errors.timeFrom ?? errors.timeTo}>
            <div className="flex items-center gap-3">
              <input type="time" aria-label="Начало" className={field} value={form.timeFrom} onChange={(e) => set("timeFrom", e.target.value)} />
              <span className="text-[#6B6259]">—</span>
              <input type="time" aria-label="Окончание" className={field} value={form.timeTo} onChange={(e) => set("timeTo", e.target.value)} />
            </div>
          </Row>
          <div className="flex items-center justify-between gap-3 pt-4">
            <div>
              <span className="block text-sm font-bold">Сколько детей</span>
              <span className="text-[13px] text-[#6B6259]">
                {limits.maxChildren != null ? `в этом зале до ${limits.maxChildren}` : "приблизительно"}
                {limits.minChildren != null ? `, от ${limits.minChildren}` : ""}
              </span>
            </div>
            <Stepper label="Детей" value={form.children} min={minChildren} max={maxChildren} onChange={(n) => set("children", clampChildren(n, limits))} />
          </div>
          {errors.children ? <p role="alert" className="m-0 mt-1.5 text-[13px] font-semibold text-[#C0392B]">{errors.children}</p> : null}
          <div className="flex items-center justify-between gap-3 pt-4">
            <span className="text-sm font-bold">Сколько взрослых</span>
            <Stepper label="Взрослых" value={form.adults} min={0} max={50} onChange={(n) => set("adults", n)} />
          </div>
          {familyKids.length ? (
            <Row label="Чей праздник">
              <div className="flex flex-wrap gap-2">
                {familyKids.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={form.childName === k.name}
                    onClick={() => pickKid(k)}
                    className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", form.childName === k.name ? "border-[#141210] bg-[#141210] text-white" : "border-[rgba(20,18,16,.18)] bg-white hover:border-[#141210]")}
                  >
                    {k.name}, {k.age}
                  </button>
                ))}
              </div>
            </Row>
          ) : null}
          <Row label="Возраст именинника" hint="необязательно">
            <div role="group" aria-label="Возраст именинника" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
              {AGE_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={form.childAge === a}
                  onClick={() => set("childAge", form.childAge === a ? null : a)}
                  className={cn("min-h-11 min-w-11 shrink-0 rounded-xl border px-3 text-[15px] font-semibold", form.childAge === a ? "border-[#141210] bg-[#141210] text-white" : "border-[rgba(20,18,16,.18)] bg-white hover:border-[#141210]")}
                >
                  {a === 0 ? "<1" : a}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Как к вам обращаться" error={errors.contactName}>
            <input className={field} value={form.contactName} maxLength={120} autoComplete="name" onChange={(e) => set("contactName", e.target.value)} aria-invalid={!!errors.contactName} />
          </Row>
          <Row label="Телефон для связи" error={errors.contactPhone}>
            <div className="[&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-2xl [&_input]:border [&_input]:border-[rgba(20,18,16,.18)] [&_input]:bg-white [&_input]:px-4 [&_input]:text-base">
              <PhoneInputByMask valueE164={form.contactPhone} onChangeE164={(v) => set("contactPhone", v)} />
            </div>
          </Row>
          <Row label="Комментарий" hint="необязательно" error={errors.comment}>
            <textarea className={cn(field, "py-3 leading-snug")} rows={3} maxLength={500} placeholder="Например: торт свой, будут трое взрослых" value={form.comment} onChange={(e) => set("comment", e.target.value)} />
          </Row>
          {serverError ? <p role="alert" className="m-0 mt-4 rounded-2xl bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#8C2A20]">{serverError}</p> : null}
        </div>
      )}
    </ResponsiveOverlay>
  );
}
