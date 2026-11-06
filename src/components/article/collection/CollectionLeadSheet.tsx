"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, Plus } from "lucide-react";
import { PhoneInputByMask } from "@/components/phone/PhoneInputByMask";
import { RS, RsChip, RsChipRow, RsConfirmBar, RsDateCards, RsGhostLink, RsInput, RsSection, RsStepper, RsSuccess, RsTextarea, RequestSheetFrame } from "@/components/request/requestSheetKit";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { useAuthMe } from "@/lib/auth/useAuthMe";
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

  const fmtLong = (iso: string) => {
    const chip = dateChips.find((c) => c.iso === iso);
    if (chip) return `${chip.weekday}, ${chip.day} ${chip.month}`;
    const d = new Date(`${iso}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  };
  const summary = form.eventDate
    ? `${fmtLong(form.eventDate)} · ${form.timeFrom}–${form.timeTo} · ${form.children} ${form.children === 1 ? "ребёнок" : "детей"}`
    : "Дата не выбрана";

  return (
    <RequestSheetFrame
      open={open}
      onOpenChange={onOpenChange}
      ticket={{ title: card.title, imageUrl: card.imageUrl, venue: card.placeName, priceLabel: card.priceLabel }}
      heading={sent ? <>Заявка отправлена</> : <>Когда праздник?</>}
    >
      {sent ? (
        <RsSuccess
          title="Спасибо!"
          text={`${card.placeName ?? "Площадка"} пришлёт предложение с ценой и условиями — оно появится в вашей заявке. Телефон площадка увидит только после того, как вы подтвердите праздник.`}
        >
          <div className="rounded-[20px] p-4 text-left" style={{ background: RS.accentSoft }}>
            <b className="block text-base text-[#5E2A0E]">Добавить в «Мой план»?</b>
            <span className="mt-1 block text-[13.5px] leading-snug text-[#6E3A1E]">Поставим праздник на выбранную дату, чтобы он не потерялся. Ответ площадки придёт в вашу заявку.</span>
            {planState === "done" ? (
              <Link href="/me/plan" className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold !text-white !no-underline" style={{ background: RS.accent }}>
                <Check className="size-4" aria-hidden="true" /> В плане · открыть
              </Link>
            ) : (
              <button type="button" onClick={addToPlan} disabled={planState === "saving"} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white disabled:opacity-60" style={{ background: RS.accent }}>
                <Plus className="size-4" aria-hidden="true" /> {planState === "saving" ? "Добавляем…" : "Добавить в план"}
              </button>
            )}
            {planState === "error" ? <span role="alert" className="mt-2 block text-[13px] font-semibold" style={{ color: RS.danger }}>Не удалось добавить в план. Заявка при этом отправлена.</span> : null}
          </div>
          <RsGhostLink href={`/me/birthdays/${sent.partyId}`}>Открыть мою заявку</RsGhostLink>
          <button type="button" onClick={() => onOpenChange(false)} className="inline-flex min-h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold" style={{ color: RS.ink3 }}>
            Вернуться к подборке
          </button>
        </RsSuccess>
      ) : (
        <>
          <RsSection label="Дата праздника" error={errors.eventDate}>
            <RsDateCards
              items={dateChips.map((c) => ({ key: c.iso, weekday: c.weekday, day: c.day, month: c.month }))}
              value={form.eventDate}
              onChange={(iso) => { set("eventDate", iso); setAnyDate(false); }}
              trailing={
                <button
                  type="button"
                  aria-pressed={anyDate}
                  onClick={() => setAnyDate((v) => !v)}
                  className="flex h-[88px] w-[68px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed text-[#3A332B]"
                  style={{ borderColor: anyDate ? RS.peachLine : "#DCD4C9", background: anyDate ? RS.peach : "transparent" }}
                >
                  <CalendarDays className="size-5" aria-hidden="true" />
                  <span className="font-mono text-[10px] uppercase tracking-[.12em]" style={{ color: RS.ink3 }}>другая</span>
                </button>
              }
            />
            {anyDate || (form.eventDate && !dateChips.some((c) => c.iso === form.eventDate)) ? (
              <input
                type="date"
                aria-label="Другая дата"
                value={form.eventDate}
                min={earliestLeadDate()}
                onChange={(e) => set("eventDate", e.target.value)}
                aria-invalid={!!errors.eventDate}
                className="mt-2 min-h-[52px] w-full rounded-[14px] border bg-[#FAF7F1] px-4 text-[15px] focus:border-[#E86A3A] focus:outline-none"
                style={{ borderColor: RS.line }}
              />
            ) : null}
          </RsSection>

          <RsSection label="Время" error={errors.timeFrom ?? errors.timeTo}>
            <div className="flex items-center gap-3">
              <RsInput type="time" aria-label="Начало" value={form.timeFrom} onChange={(e) => set("timeFrom", e.target.value)} />
              <span style={{ color: RS.ink3 }}>—</span>
              <RsInput type="time" aria-label="Окончание" value={form.timeTo} onChange={(e) => set("timeTo", e.target.value)} />
            </div>
          </RsSection>

          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[.12em]" style={{ color: RS.ink3 }}>Сколько детей</div>
              <div className="mt-0.5 text-xs" style={{ color: RS.ink3 }}>
                {limits.maxChildren != null ? `в этом зале до ${limits.maxChildren}` : "приблизительно"}
                {limits.minChildren != null ? `, от ${limits.minChildren}` : ""}
              </div>
            </div>
            <RsStepper label="Детей" value={form.children} min={minChildren} max={maxChildren} onChange={(n) => set("children", clampChildren(n, limits))} />
          </div>
          {errors.children ? <p role="alert" className="-mt-2 mb-3 text-xs font-semibold" style={{ color: RS.danger }}>{errors.children}</p> : null}
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[.12em]" style={{ color: RS.ink3 }}>Сколько взрослых</span>
            <RsStepper label="Взрослых" value={form.adults} min={0} max={50} onChange={(n) => set("adults", n)} />
          </div>

          {familyKids.length ? (
            <RsSection label="Чей праздник">
              <RsChipRow>
                {familyKids.map((k) => (
                  <RsChip key={k.id} active={form.childName === k.name} onClick={() => pickKid(k)}>
                    {k.name}, {k.age}
                  </RsChip>
                ))}
              </RsChipRow>
            </RsSection>
          ) : null}

          <RsSection label="Возраст именинника" hint="необязательно">
            <RsChipRow scroll>
              {AGE_OPTIONS.map((a) => (
                <RsChip key={a} active={form.childAge === a} onClick={() => set("childAge", form.childAge === a ? null : a)}>
                  {a === 0 ? "<1" : a}
                </RsChip>
              ))}
            </RsChipRow>
          </RsSection>

          <RsSection label="Как к вам обращаться" error={errors.contactName}>
            <RsInput value={form.contactName} maxLength={120} autoComplete="name" onChange={(e) => set("contactName", e.target.value)} invalid={!!errors.contactName} />
          </RsSection>
          <RsSection label="Телефон для связи" error={errors.contactPhone}>
            <div className="[&_input]:min-h-[52px] [&_input]:w-full [&_input]:rounded-[14px] [&_input]:border [&_input]:border-[rgba(20,18,16,.10)] [&_input]:bg-[#FAF7F1] [&_input]:px-4 [&_input]:text-[15px]">
              <PhoneInputByMask valueE164={form.contactPhone} onChangeE164={(v) => set("contactPhone", v)} />
            </div>
          </RsSection>
          <RsSection label="Комментарий" hint="необязательно" error={errors.comment}>
            <RsTextarea rows={3} maxLength={500} placeholder="Например: торт свой, будут трое взрослых" value={form.comment} onChange={(e) => set("comment", e.target.value)} />
          </RsSection>
          {serverError ? <p role="alert" className="m-0 mb-3 rounded-2xl bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#8C2A20]">{serverError}</p> : null}

          <RsConfirmBar
            summary={summary}
            actionLabel={isAuthenticated ? "Отправить заявку" : "Продолжить"}
            onAction={onSubmit}
            busy={busy}
            disabled={isLoading}
            note={isAuthenticated ? "Это ещё не бронь — площадка уточнит детали и цену." : "Для отправки понадобится войти — введённые данные сохранятся."}
          />
        </>
      )}
    </RequestSheetFrame>
  );
}
