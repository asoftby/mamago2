"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { PhoneInputByMask } from "@/components/phone/PhoneInputByMask";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { cn } from "@/lib/utils";
import { CollectionLeadError, submitCollectionLead, type CollectionLeadProgress } from "@/lib/article/collectionLeadApi";
import {
  clampChildren, clearLeadDraft, earliestLeadDate, initialLeadForm, loadLeadDraft, saveLeadDraft,
  validateLeadForm, withLeadReturnParam, type CollectionLeadErrors, type CollectionLeadForm,
} from "@/lib/article/collectionLeadForm";
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
  const [sent, setSent] = useState<{ partyId: string } | null>(null);
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
    progress.current = { idempotencyKey: `cl_${crypto.randomUUID().replace(/-/g, "")}` };
    track(card, restored ? "resume" : "open");
  }, [open, card, limits, adultName]);

  if (!party) return null;
  const set = <K extends keyof CollectionLeadForm>(key: K, value: CollectionLeadForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
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
      setSent({ partyId: res.partyId });
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
          <p className="m-0 max-w-[300px] text-[15px] text-[#3A332B]">{`${card.placeName ?? "Площадка"} свяжется с вами по телефону из заявки.`}</p>
          <Link href={`/me/birthdays/${sent.partyId}`} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[#E86A3A] px-6 text-[15px] font-semibold text-white hover:bg-[#C24E22]">
            Открыть мою заявку
          </Link>
        </div>
      ) : (
        <div className="overflow-y-auto px-4 pb-4 sm:px-5">
          <Row label="Дата праздника" error={errors.eventDate}>
            <input type="date" className={field} value={form.eventDate} min={earliestLeadDate()} onChange={(e) => set("eventDate", e.target.value)} aria-invalid={!!errors.eventDate} />
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
          <Row label="Возраст именинника" hint="необязательно">
            <select className={cn(field, "appearance-none")} value={form.childAge ?? ""} onChange={(e) => set("childAge", e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">Не указывать</option>
              {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a === 0 ? "до года" : `${a} ${a % 10 === 1 && a !== 11 ? "год" : a % 10 >= 2 && a % 10 <= 4 && (a < 12 || a > 14) ? "года" : "лет"}`}</option>)}
            </select>
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
