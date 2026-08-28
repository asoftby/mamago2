"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminPath } from "@/lib/routing/surface";

type PolicyConfig = {
  resultCount: number;
  horizonDays: number;
  minimumScore: number;
  minimumResultCount: number;
  maxPerCategory: number;
  repeatCooldownDays: number;
};

type PolicyRow = {
  id: string;
  version: number;
  status: string;
  algorithmVersion: string;
  config: PolicyConfig;
  publishedAt: string | null;
  updatedAt: string;
};

type PolicyState = {
  algorithmVersion: string;
  defaults: PolicyConfig;
  draft: PolicyRow | null;
  published: PolicyRow | null;
  effectiveConfig: PolicyConfig;
  deliveryEnabled: boolean;
};

type Preview = {
  previewOnly: boolean;
  algorithmVersion: string;
  policy: PolicyConfig;
  context: {
    citySlug: string;
    dateFrom: string;
    dateTo: string;
    ageRanges: string[];
    userEmail: string | null;
    userFound: boolean;
    cooldownApplied: boolean;
  };
  candidateCount: number;
  rankedCount: number;
  selectedCount: number;
  noSendReason: "NO_CANDIDATES" | "MIN_RESULT_COUNT" | null;
  filtered: {
    belowMinimumScore: number;
    repeatCooldown: number;
    categoryDiversity: number;
  };
  suggestions: Array<{
    id: string;
    slug: string;
    title: string;
    category: string | null;
    ageLabel: string | null;
    score: number;
    position: number;
    reasonCodes: string[];
    scoreBreakdown: {
      engagementScore: number;
      freshnessSortAt: string;
      ageFilterApplied: boolean;
      ageFallbackUsed: boolean;
    };
  }>;
};

const FIELD_META: Array<{
  key: keyof PolicyConfig;
  label: string;
  hint: string;
  min: number;
  max: number;
}> = [
  {
    key: "resultCount",
    label: "Карточек в подборке",
    hint: "Сколько позиций Telegram получит после всех фильтров policy.",
    min: 1,
    max: 10,
  },
  {
    key: "horizonDays",
    label: "Горизонт, дней",
    hint: "Окно кандидатов от выбранной даты. Это composition constraint, не ranking weight.",
    min: 1,
    max: 30,
  },
  {
    key: "minimumScore",
    label: "Минимальный score",
    hint: "Отсекает слабые результаты после общего ranking. 0 = без порога.",
    min: 0,
    max: 1000000,
  },
  {
    key: "minimumResultCount",
    label: "Минимум для отправки",
    hint: "Если после policy осталось меньше — no-send вместо слабой подборки.",
    min: 0,
    max: 10,
  },
  {
    key: "maxPerCategory",
    label: "Максимум из одной категории",
    hint: "Диверсификация без пересчёта общего score.",
    min: 1,
    max: 10,
  },
  {
    key: "repeatCooldownDays",
    label: "Cooldown повтора, дней",
    hint: "Не повторять EVENT, уже показанный этому пользователю в Telegram.",
    min: 0,
    max: 90,
  },
];

function noSendLabel(reason: Preview["noSendReason"]) {
  if (reason === "NO_CANDIDATES") return "Нет кандидатов в выбранном окне";
  if (reason === "MIN_RESULT_COUNT") return "Не достигнут минимальный размер подборки";
  return null;
}

export default function TelegramRankingPage() {
  const [state, setState] = useState<PolicyState | null>(null);
  const [config, setConfig] = useState<PolicyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [citySlug, setCitySlug] = useState("minsk");
  const [dateFrom, setDateFrom] = useState("");
  const [ageRanges, setAgeRanges] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/ranking/telegram", {
        credentials: "include",
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Не удалось загрузить policy");
      const nextState = body as PolicyState;
      setState(nextState);
      setConfig(nextState.draft?.config ?? nextState.published?.config ?? nextState.defaults);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить policy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const expectedUpdatedAt = state?.draft?.updatedAt ?? null;
  const policySource = useMemo(() => {
    if (state?.draft) return `Draft v${state.draft.version}`;
    if (state?.published) return `Published v${state.published.version}`;
    return "Default";
  }, [state]);

  function updateNumber(key: keyof PolicyConfig, value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setConfig((current) => (current ? { ...current, [key]: parsed } : current));
  }

  async function mutate(action: "save-draft" | "publish") {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/ranking/telegram", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, config, expectedUpdatedAt }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Не удалось обновить policy");
      setMessage(action === "publish" ? "Policy опубликована." : "Draft сохранён.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обновить policy");
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    if (!config) return;
    setPreviewLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/ranking/telegram/preview", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          config,
          citySlug,
          dateFrom: dateFrom || undefined,
          ageRanges: ageRanges
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          userEmail: userEmail || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Не удалось построить preview");
      setPreview(body as Preview);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось построить preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading || !state || !config) {
    return <main className="p-6 text-sm text-stone-500">Загрузка Ranking → Telegram…</main>;
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Ranking → Telegram</p>
          <h1 className="mt-1 text-2xl font-semibold text-stone-950">Telegram surface policy</h1>
          <p className="mt-2 max-w-3xl text-sm text-stone-500">
            Telegram использует общий EVENT ranking. Здесь настраивается только composition policy:
            горизонт, количество, diversity, cooldown и no-send gate. Весов поведения здесь нет.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link href={adminPath("/communications/telegram")}>
            Communications → Telegram
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-3xl border-stone-200/90">
          <CardHeader className="pb-3">
            <CardDescription>Shared algorithm</CardDescription>
            <CardTitle className="text-lg">{state.algorithmVersion}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-3xl border-stone-200/90">
          <CardHeader className="pb-3">
            <CardDescription>Policy state</CardDescription>
            <CardTitle className="text-lg">{policySource}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-3xl border-amber-200 bg-amber-50/60">
          <CardHeader className="pb-3">
            <CardDescription className="text-amber-700">Delivery</CardDescription>
            <CardTitle className="text-lg text-amber-950">Выключен</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-800">
            Публикация policy не отправляет сообщения и не включает Telegram delivery.
          </CardContent>
        </Card>
      </div>

      {message ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">{message}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)]">
        <Card className="rounded-3xl border-stone-200/90">
          <CardHeader>
            <CardTitle>Composition policy</CardTitle>
            <CardDescription>
              Все поля реально применяются в preview. Публикация создаёт версионированную RecommendationSurfacePolicy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELD_META.map((field) => (
                <div key={field.key} className="space-y-2 rounded-2xl border border-stone-200 p-4">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={config[field.key]}
                    onChange={(event) => updateNumber(field.key, event.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-xs leading-5 text-stone-500">{field.hint}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 border-t border-stone-100 pt-5">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                disabled={saving}
                onClick={() => void mutate("save-draft")}
              >
                <Save className="h-4 w-4" />
                Сохранить draft
              </Button>
              <Button
                type="button"
                className="rounded-2xl"
                disabled={saving}
                onClick={() => void mutate("publish")}
              >
                <Send className="h-4 w-4" />
                Опубликовать policy
              </Button>
            </div>

            <p className="text-xs text-stone-400">
              Published policy версионируется отдельно от algorithmVersion. Следующее редактирование создаст новый draft/version.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-stone-200/90">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Read-only симуляция: не создаёт RecommendationRun/Exposure и не влияет на learning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preview-city">Город</Label>
                <Input id="preview-city" value={citySlug} onChange={(e) => setCitySlug(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-date">Дата старта</Label>
                <Input id="preview-date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-age">Возрастные группы</Label>
                <Input
                  id="preview-age"
                  value={ageRanges}
                  onChange={(e) => setAgeRanges(e.target.value)}
                  placeholder="3-5, 5-7"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-user">Email пользователя</Label>
                <Input
                  id="preview-user"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="только для cooldown"
                  className="rounded-xl"
                />
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full rounded-2xl" disabled={previewLoading} onClick={() => void runPreview()}>
              <Eye className="h-4 w-4" />
              {previewLoading ? "Строим preview…" : "Показать результат"}
            </Button>

            {preview ? (
              <div className="space-y-4 border-t border-stone-100 pt-5">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-stone-50 p-3">
                    <div className="text-stone-400">Candidates</div>
                    <div className="mt-1 text-lg font-semibold text-stone-900">{preview.candidateCount}</div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3">
                    <div className="text-stone-400">Ranked</div>
                    <div className="mt-1 text-lg font-semibold text-stone-900">{preview.rankedCount}</div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3">
                    <div className="text-stone-400">Selected</div>
                    <div className="mt-1 text-lg font-semibold text-stone-900">{preview.selectedCount}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 text-xs text-stone-600">
                  <div>{preview.context.dateFrom} → {preview.context.dateTo}</div>
                  <div className="mt-1">Filtered: score {preview.filtered.belowMinimumScore} · cooldown {preview.filtered.repeatCooldown} · diversity {preview.filtered.categoryDiversity}</div>
                  {preview.context.userEmail ? (
                    <div className="mt-1">
                      User: {preview.context.userFound ? "найден" : "не найден"} · cooldown {preview.context.cooldownApplied ? "применён" : "не применён"}
                    </div>
                  ) : null}
                </div>

                {preview.noSendReason ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No-send: {noSendLabel(preview.noSendReason)}.
                  </div>
                ) : null}

                <div className="space-y-3">
                  {preview.suggestions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs text-stone-400">#{item.position} · {item.category ?? "Без категории"}</div>
                          <div className="mt-1 font-medium text-stone-950">{item.title}</div>
                        </div>
                        <div className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-stone-700">
                          score {item.score}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.reasonCodes.map((code) => (
                          <span key={code} className="rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-600">{code}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!preview.noSendReason && preview.suggestions.length === 0 ? (
                    <p className="text-sm text-stone-500">Подходящих элементов нет.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
