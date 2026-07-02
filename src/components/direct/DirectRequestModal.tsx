"use client";

/**
 * Shared "Отправить заявку" form for Offer/Event/Place pages — reuses the
 * visual language of EventSimpleBookingModal (the existing "Записаться"
 * form) rather than inventing a new one, per Phase 2 scope: "если уже есть
 * похожая форма — максимально переиспользовать".
 *
 * Unlike that booking form, Direct has no anonymous path: submitting
 * requires an authenticated customerUserId. If the user isn't logged in
 * when they hit submit, the typed draft is stashed (sessionStorage, see
 * directDraftStorage.ts) and they're sent to /login?redirectTo=<thisPage>;
 * on return the page reopens this modal pre-filled so they can finish
 * sending without retyping anything.
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { useCurrentPath } from "@/hooks/useCurrentPath";
import {
  saveDirectRequestDraft,
  type DirectRequestDraft,
} from "@/lib/direct/directDraftStorage";

const schema = z.object({
  comment: z.string().min(1, "Расскажите, что вас интересует").max(2000),
  date: z.string().max(60).optional(),
  childAge: z.string().max(20).optional(),
  guestsCount: z.string().max(10).optional(),
});
type FormValues = z.infer<typeof schema>;
type Phase = "form" | "submitting" | "success" | "error";

const fieldInputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", borderRadius: 14,
  background: "#FAF7F1", border: "1.5px solid rgba(20,18,16,.10)",
  fontSize: 15, color: "#141210", outline: "none",
  transition: "border-color .18s, box-shadow .18s",
  fontFamily: "inherit",
};
const focusStyle = (el: HTMLElement) => { el.style.borderColor = "#E86A3A"; el.style.boxShadow = "0 0 0 3px rgba(232,106,58,.12)"; };
const blurStyle = (el: HTMLElement) => { el.style.borderColor = "rgba(20,18,16,.10)"; el.style.boxShadow = "none"; };

const FieldInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input ref={ref} style={fieldInputStyle} onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)} {...props} />
  ),
);
FieldInput.displayName = "FieldInput";

const FieldTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => (
    <textarea ref={ref} style={{ ...fieldInputStyle, resize: "none" }} onFocus={(e) => focusStyle(e.target)} onBlur={(e) => blurStyle(e.target)} {...props} />
  ),
);
FieldTextarea.displayName = "FieldTextarea";

function FieldWrap({ label, labelSuffix, error, children }: { label: string; labelSuffix?: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <label style={{ fontSize: 13, color: "#3A332B", fontWeight: 500 }}>
        {label}{labelSuffix && <span style={{ fontSize: 12, color: "rgba(20,18,16,.55)", fontWeight: 400, marginLeft: 4 }}>{labelSuffix}</span>}
      </label>
      {children}
      {error && <p style={{ margin: 0, fontSize: 12, color: "#C24E22" }}>{error}</p>}
    </div>
  );
}

function XBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} aria-label="Закрыть"
      style={{
        width: 36, height: 36, borderRadius: 99, border: "1px solid rgba(20,18,16,.18)",
        color: "#3A332B", display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", fontSize: 13, transition: "all .2s", cursor: "pointer", flexShrink: 0,
      }}
    >✕</button>
  );
}

export type DirectPublicationRef = {
  publicationType: "OFFER" | "EVENT" | "PLACE";
  offerId?: string;
  activityId?: string;
  placeId?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationRef: DirectPublicationRef;
  publicationTitle: string;
  brandName: string;
  /** Pre-fill on resume-after-login. */
  initialValues?: Partial<FormValues>;
};

export function DirectRequestModal({
  open, onOpenChange, publicationRef, publicationTitle, brandName, initialValues,
}: Props) {
  const router = useRouter();
  const currentPath = useCurrentPath();
  const [phase, setPhase] = useState<Phase>("form");
  const [apiError, setApiError] = useState<string | null>(null);
  const [threadHref, setThreadHref] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      comment: initialValues?.comment ?? "",
      date: initialValues?.date ?? "",
      childAge: initialValues?.childAge ?? "",
      guestsCount: initialValues?.guestsCount ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setPhase("submitting");
    setApiError(null);
    try {
      const res = await fetch("/api/public/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...publicationRef, ...values }),
      });

      if (res.status === 401) {
        // Not logged in — stash the draft and resume on return, instead of
        // erroring out (Direct has no anonymous path, unlike booking).
        const draft: DirectRequestDraft = { ...publicationRef, ...values };
        saveDirectRequestDraft(draft);
        router.push(buildAuthUrl({ redirectTo: currentPath }));
        return;
      }

      const json = await res.json() as { threadId?: string; threadNumber?: number; error?: string };
      if (!res.ok || !json.threadId) {
        setApiError(json.error ?? "Не удалось отправить заявку.");
        setPhase("error");
        return;
      }
      setThreadHref(`/me/direct/${json.threadId}`);
      setPhase("success");
    } catch {
      setApiError("Ошибка соединения. Попробуйте ещё раз.");
      setPhase("error");
    }
  }

  function handleClose(val: boolean) {
    if (!val) {
      reset();
      setPhase("form");
      setApiError(null);
      setThreadHref(null);
    }
    onOpenChange(val);
  }

  if (phase === "success") {
    return (
      <ResponsiveOverlay open={open} onOpenChange={handleClose} a11yTitle="Заявка отправлена" variant="chromeless">
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          padding: "44px 32px", textAlign: "center", background: "#F6F2EA", borderRadius: 24, position: "relative",
        }}>
          <button
            type="button" onClick={() => handleClose(false)}
            style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 99, border: "1px solid rgba(20,18,16,.18)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}
          >✕</button>

          <div style={{ width: 64, height: 64, borderRadius: 99, background: "rgba(31,138,91,.12)", color: "#1F8A5B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</div>

          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 32, lineHeight: 1, letterSpacing: "-.02em", color: "#141210" }}>
              Заявка <em style={{ fontStyle: "italic", color: "#C24E22" }}>отправлена</em>!
            </h2>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "rgba(20,18,16,.55)", lineHeight: 1.55, maxWidth: 320 }}>
              Продолжить общение можно в личных сообщениях — {brandName} ответит там же.
            </p>
          </div>

          {threadHref && (
            <a
              href={threadHref}
              style={{
                height: 50, padding: "0 26px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 8,
                background: "linear-gradient(180deg, #FBA77B, #E86A3A)", color: "#fff", fontSize: 15, fontWeight: 600,
                textDecoration: "none", boxShadow: "0 14px 32px -10px rgba(232,106,58,.55)",
              }}
            >
              Открыть сообщения <span aria-hidden>→</span>
            </a>
          )}

          <button
            onClick={() => handleClose(false)}
            style={{ height: 44, padding: "0 24px", borderRadius: 99, background: "transparent", border: "1px solid rgba(20,18,16,.18)", color: "#141210", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Закрыть
          </button>
        </div>
      </ResponsiveOverlay>
    );
  }

  return (
    <ResponsiveOverlay open={open} onOpenChange={handleClose} a11yTitle="Отправить заявку" variant="chromeless" heightMode="tall">
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F6F2EA", borderRadius: 24, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 18px", borderBottom: "1px solid rgba(20,18,16,.10)", flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 28, lineHeight: 1, letterSpacing: "-.02em", color: "#141210" }}>
            Отправить <em style={{ fontStyle: "italic", color: "#C24E22" }}>заявку</em>
          </h2>
          <XBtn onClick={() => handleClose(false)} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          <form id="direct-request-form" onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px 10px 10px", background: "#FAF7F1", border: "1px solid rgba(20,18,16,.10)", borderRadius: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(20,18,16,.55)", marginBottom: 2 }}>
                  {brandName}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#141210", letterSpacing: "-.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {publicationTitle}
                </div>
              </div>
            </div>

            <FieldWrap label="Комментарий" error={errors.comment?.message}>
              <FieldTextarea id="dr-comment" placeholder="Что вас интересует, какие вопросы остались..." rows={4} {...register("comment")} />
            </FieldWrap>

            <FieldWrap label="Дата" labelSuffix="(необязательно)">
              <FieldInput id="dr-date" placeholder="Например, на следующих выходных" {...register("date")} />
            </FieldWrap>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FieldWrap label="Возраст ребёнка" labelSuffix="(необязательно)">
                <FieldInput id="dr-child-age" placeholder="Например, 5 лет" {...register("childAge")} />
              </FieldWrap>
              <FieldWrap label="Количество гостей" labelSuffix="(необязательно)">
                <FieldInput id="dr-guests" placeholder="Например, 2" {...register("guestsCount")} />
              </FieldWrap>
            </div>

            {phase === "error" && apiError && (
              <p style={{ margin: 0, padding: "12px 16px", borderRadius: 12, background: "#FEF2F2", fontSize: 13, color: "#B91C1C", lineHeight: 1.5 }}>
                {apiError}
              </p>
            )}
          </form>
        </div>

        <div style={{ padding: "14px 22px 20px", flexShrink: 0, borderTop: "1px solid rgba(20,18,16,.08)" }}>
          <button
            form="direct-request-form" type="submit" disabled={phase === "submitting"}
            style={{
              width: "100%", height: 56, borderRadius: 99,
              background: phase === "submitting" ? "rgba(20,18,16,.18)" : "linear-gradient(180deg, #FBA77B, #E86A3A)",
              color: phase === "submitting" ? "rgba(20,18,16,.45)" : "#fff",
              fontSize: 15, fontWeight: 600, letterSpacing: ".005em", border: 0,
              cursor: phase === "submitting" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: phase === "submitting" ? "none" : "0 18px 40px -12px rgba(232,106,58,.55)",
              fontFamily: "inherit",
            }}
          >
            {phase === "submitting" ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : "Отправить заявку"}
          </button>
          <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12, color: "rgba(20,18,16,.45)" }}>
            Остались вопросы? Напишите их в заявке — исполнитель ответит в личных сообщениях.
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ResponsiveOverlay>
  );
}
