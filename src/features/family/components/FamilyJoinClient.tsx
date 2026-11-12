"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  initialMergeDecision,
  joinErrorMessage,
  needsMergeStep,
  type JoinPreview,
} from "@/features/family/lib/familyJoinView";
import type { MergeDecision } from "@/server/family/familyMergePure";

const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50";

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, data: {} };
  }
}

export function FamilyJoinClient(props: { token: string; consentVersion: string; consentText: string[] }) {
  const router = useRouter();
  const { token, consentVersion, consentText } = props;
  const [agreed, setAgreed] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [decision, setDecision] = useState<MergeDecision | null>(null);

  async function accept(merge?: MergeDecision) {
    setBusy(true);
    setError(null);
    const res = await post("/api/family/invites/accept", { token, consentTextVersion: consentVersion, ...(merge ? { merge } : {}) });
    setBusy(false);
    if (!res.ok) {
      setError(joinErrorMessage(res.data.error as string | undefined));
      return;
    }
    router.push("/me/profile");
    router.refresh();
  }

  async function next() {
    setBusy(true);
    setError(null);
    const res = await post("/api/family/invites/preview", { token, consentTextVersion: consentVersion });
    setBusy(false);
    if (!res.ok) {
      setError(joinErrorMessage(res.data.error as string | undefined));
      return;
    }
    const p = res.data.preview as JoinPreview;
    if (!needsMergeStep(p)) {
      await accept();
      return;
    }
    setPreview(p);
    setDecision(initialMergeDecision(p));
  }

  function setChild(childId: string, value: string) {
    if (!decision) return;
    const children = decision.children.map((c) => {
      if (c.childId !== childId) return c;
      if (value === "ADD") return { childId, action: "ADD" as const };
      if (value === "SKIP") return { childId, action: "SKIP" as const };
      return { childId, action: "SAME" as const, targetChildId: value.replace(/^SAME:/, "") };
    });
    setDecision({ ...decision, children });
  }

  if (preview && decision) {
    return (
      <div className="mt-4">
        <p className="text-neutral-600">Вы уже добавляли данные у себя. Решите, что с ними сделать. Ничего не объединяется само.</p>
        {preview.joinerChildren.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {preview.joinerChildren.map((c) => {
              const d = decision.children.find((x) => x.childId === c.id);
              const value = d?.action === "SAME" ? `SAME:${d.targetChildId}` : (d?.action ?? "ADD");
              return (
                <li key={c.id} className="rounded-xl border border-neutral-200 p-3">
                  <p className="text-sm font-medium text-neutral-900">
                    {c.name || "Ребёнок"}{c.birthYear ? `, ${c.birthYear} г.р.` : ""}
                  </p>
                  <select value={value} onChange={(e) => setChild(c.id, e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm">
                    {preview.targetChildren.map((t) => (
                      <option key={t.id} value={`SAME:${t.id}`}>
                        Это тот же: {t.name || "ребёнок"}{t.birthYear ? `, ${t.birthYear}` : ""}
                      </option>
                    ))}
                    <option value="ADD">Добавить как нового ребёнка в семью</option>
                    <option value="SKIP">Не переносить</option>
                  </select>
                </li>
              );
            })}
          </ul>
        ) : null}
        {preview.planItemCount > 0 ? (
          <fieldset className="mt-4 rounded-xl border border-neutral-200 p-3">
            <legend className="px-1 text-sm font-medium text-neutral-900">Ваш личный план ({preview.planItemCount})</legend>
            {([
              ["PRIVATE", "Перенести как личный (виден только вам)"],
              ["FAMILY", "Перенести как общий (виден семье)"],
              ["SKIP", "Не переносить"],
            ] as const).map(([v, label]) => (
              <label key={v} className="mt-2 flex items-start gap-2 text-sm text-neutral-800">
                <input type="radio" name="plan" checked={decision.plan === v} onChange={() => setDecision({ ...decision, plan: v })} className="mt-1" />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button type="button" className={`${btnPrimary} mt-5`} disabled={busy} onClick={() => accept(decision)}>
          Присоединиться
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Приглашение в семью</p>
        <h2 className="mt-2 font-serif text-xl font-semibold text-neutral-950">Планировать вместе проще</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Вы сможете вместе управлять семейными делами и планами на mamaGo.
          Перед присоединением проверьте, какой доступ вы получите.
        </p>
        <div className="mt-5 space-y-4" aria-label="Ваш доступ">
          <div className="flex gap-3">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">✓</span>
            <div><p className="text-sm font-medium text-neutral-950">Дети и общие планы</p>
              <p className="mt-0.5 text-sm text-neutral-600">Будут доступны вам и другим взрослым членам семьи.</p></div>
          </div>
          <div className="flex gap-3">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">✓</span>
            <div><p className="text-sm font-medium text-neutral-950">Совместное планирование</p>
              <p className="mt-0.5 text-sm text-neutral-600">Можно создавать и изменять общие записи.</p></div>
          </div>
          <div className="flex gap-3">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">♡</span>
            <div><p className="text-sm font-medium text-neutral-950">Личные записи остаются личными</p>
              <p className="mt-0.5 text-sm text-neutral-600">Другие участники не увидят записи, отмеченные как личные.</p></div>
          </div>
        </div>
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <button type="button" onClick={() => setShowConsent(true)}
            className="min-h-11 text-left text-sm font-medium text-neutral-800 underline underline-offset-4 hover:text-neutral-950">
            Прочитать соглашение о присоединении
          </button>
          <div className="mt-2 flex items-start gap-3 text-sm leading-relaxed text-neutral-800">
            <input type="checkbox" id="family-join-consent" aria-label="Я принимаю условия соглашения о присоединении"
              checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-4 shrink-0 cursor-pointer accent-neutral-900" />
            <div>
              <label htmlFor="family-join-consent" className="cursor-pointer">Я принимаю условия </label>
              <button type="button" onClick={() => setShowConsent(true)}
                className="inline min-h-6 font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-700">
                соглашения о присоединении
              </button>
              <span>.</span>
            </div>
          </div>
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button type="button" className={`${btnPrimary} mt-5 w-full`} disabled={!agreed || busy} onClick={next}>
          {busy ? "Подключаем..." : "Присоединиться к семье"}
        </button>
      </div>
      {showConsent ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowConsent(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="family-consent-title"
            className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-4">
              <h2 id="family-consent-title" className="text-lg font-semibold text-neutral-950">Соглашение о присоединении</h2>
              <button type="button" autoFocus aria-label="Закрыть соглашение" onClick={() => setShowConsent(false)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-neutral-100">✕</button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4 text-sm leading-relaxed text-neutral-700">
              {consentText.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            </div>
            <div className="border-t border-neutral-200 p-4">
              <button type="button" className={`${btnPrimary} w-full`} onClick={() => setShowConsent(false)}>Понятно</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
