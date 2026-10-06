"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type {
  GeoScope,
  SeoContentPlanPriority,
  SeoContentPlanStatus,
} from "@prisma/client";

export type PlanItemRow = {
  id: string;
  title: string;
  targetQuery: string | null;
  geoScope: GeoScope;
  scheduledFor: string | null;
  status: SeoContentPlanStatus;
  priority: SeoContentPlanPriority;
  city: { id: string; name: string; slug: string } | null;
  region: { id: string; name: string; slug: string } | null;
  article: { id: string; title: string; slug: string | null } | null;
};

type Mix = {
  plannedTotal: number;
  cityCount: number;
  regionCount: number;
  targets: { city: number; region: number; national: number };
  cityShare: number;
  regionShare: number;
  belowRegionTarget: boolean;
};

type Props = {
  marketLabel: string;
  period: "week" | "month";
  periodLabel: string;
  prevHref: string;
  nextHref: string;
  weekHref: string;
  monthHref: string;
  items: PlanItemRow[];
  mix: Mix;
  defaultCityId: string | null;
  defaultRegionId: string | null;
  defaultCityName: string | null;
  defaultRegionName: string | null;
};

const STATUS_LABEL: Record<SeoContentPlanStatus, string> = {
  IDEA: "Идея",
  PLANNED: "Запланировано",
  IN_PROGRESS: "В работе",
  PUBLISHED: "Опубликовано",
};

const PRIORITY_LABEL: Record<SeoContentPlanPriority, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
};

function geoLabel(row: PlanItemRow): string {
  if (row.geoScope === "CITY") return row.city?.name ?? "Город";
  if (row.geoScope === "REGION") return row.region?.name ?? "Регион";
  return "Беларусь";
}

export function SeoContentPlanClient(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    targetQuery: "",
    geo: "CITY" as "CITY" | "REGION",
    scheduledFor: "",
    priority: "HIGH" as SeoContentPlanPriority,
    notes: "",
  });

  const statusCounts = useMemo(() => {
    const counts = { IDEA: 0, PLANNED: 0, IN_PROGRESS: 0, PUBLISHED: 0 };
    for (const item of props.items) counts[item.status] += 1;
    return counts;
  }, [props.items]);

  async function createItem() {
    setError(null);
    const body = {
      title: form.title,
      targetQuery: form.targetQuery || null,
      geoScope: form.geo,
      cityId: form.geo === "CITY" ? props.defaultCityId : null,
      regionId: form.geo === "REGION" ? props.defaultRegionId : null,
      scheduledFor: form.scheduledFor || null,
      priority: form.priority,
      notes: form.notes || null,
      status: "PLANNED",
      source: "MANUAL",
    };
    const res = await fetch("/api/admin/seo/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка сохранения");
      return;
    }
    setOpen(false);
    setForm({
      title: "",
      targetQuery: "",
      geo: "CITY",
      scheduledFor: "",
      priority: "HIGH",
      notes: "",
    });
    startTransition(() => router.refresh());
  }

  async function setStatus(id: string, status: SeoContentPlanStatus) {
    const res = await fetch("/api/admin/seo/plan", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return;
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">План контента</h1>
          <p className="mt-1 text-sm text-gray-500">
            SEO-рынок: {props.marketLabel}
          </p>
        </div>
        <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить тему
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={props.weekHref}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
            props.period === "week"
              ? "border-primary bg-primary/10 text-primary"
              : "border-gray-200 text-gray-600"
          }`}
        >
          Неделя
        </Link>
        <Link
          href={props.monthHref}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
            props.period === "month"
              ? "border-primary bg-primary/10 text-primary"
              : "border-gray-200 text-gray-600"
          }`}
        >
          Месяц
        </Link>
        <div className="ml-auto flex items-center gap-1 text-sm text-gray-700">
          <Link href={props.prevHref} className="rounded border border-gray-200 p-1 hover:bg-gray-50" aria-label="Назад">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[10rem] text-center font-medium">{props.periodLabel}</span>
          <Link href={props.nextHref} className="rounded border border-gray-200 p-1 hover:bg-gray-50" aria-label="Вперёд">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
        <p className="font-medium text-gray-900">
          План {props.period === "week" ? "недели" : "месяца"}: {props.mix.plannedTotal} материалов
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Целевой баланс: Город {DEFAULT_CITY}% · Регион {DEFAULT_REGION}%
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Город: {props.mix.cityCount} / target {props.mix.targets.city} · Регион:{" "}
          {props.mix.regionCount} / target {props.mix.targets.region}
          {" · "}
          Баланс: {props.mix.cityShare}% город · {props.mix.regionShare}% регион
        </p>
        {props.mix.belowRegionTarget ? (
          <p className="mt-1 text-xs text-amber-700">
            Ниже целевой доли региональных публикаций
          </p>
        ) : null}
        <p className="mt-2 text-xs text-gray-500">
          Идея {statusCounts.IDEA} · Запланировано {statusCounts.PLANNED} · В работе{" "}
          {statusCounts.IN_PROGRESS} · Опубликовано {statusCounts.PUBLISHED}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-gray-50/80 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Дата</th>
                <th className="px-3 py-2 font-medium">Тема</th>
                <th className="px-3 py-2 font-medium">География</th>
                <th className="px-3 py-2 font-medium">Целевой запрос</th>
                <th className="px-3 py-2 font-medium">Приоритет</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium">Статья</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {props.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                    В этом периоде пока нет тем. Добавьте первую.
                  </td>
                </tr>
              ) : (
                props.items.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-600">
                      {row.scheduledFor
                        ? new Date(row.scheduledFor).toLocaleDateString("ru-RU")
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{row.title}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{geoLabel(row)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {row.targetQuery ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary">{PRIORITY_LABEL[row.priority]}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        className="h-8 rounded-md border border-input bg-white px-2 text-xs"
                        value={row.status}
                        disabled={pending}
                        onChange={(e) =>
                          void setStatus(row.id, e.target.value as SeoContentPlanStatus)
                        }
                      >
                        {(Object.keys(STATUS_LABEL) as SeoContentPlanStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {row.article ? (
                        <Link
                          href={`/admin/content/publications/${row.article.id}`}
                          className="text-primary hover:underline"
                        >
                          Открыть статью
                        </Link>
                      ) : row.status === "PUBLISHED" ? (
                        <span className="text-amber-700">Привяжите статью</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить тему</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Тема *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Целевой запрос
              </label>
              <Input
                value={form.targetQuery}
                onChange={(e) => setForm((f) => ({ ...f, targetQuery: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">География</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.geo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, geo: e.target.value as "CITY" | "REGION" }))
                }
              >
                <option value="CITY" disabled={!props.defaultCityId}>
                  {props.defaultCityName ?? "Город"}
                </option>
                <option value="REGION" disabled={!props.defaultRegionId}>
                  {props.defaultRegionName ?? "Регион"}
                </option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Дата публикации
              </label>
              <Input
                type="date"
                value={form.scheduledFor}
                onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Приоритет</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: e.target.value as SeoContentPlanPriority,
                  }))
                }
              >
                <option value="HIGH">Высокий</option>
                <option value="MEDIUM">Средний</option>
                <option value="LOW">Низкий</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Заметка</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={!form.title.trim() || pending} onClick={() => void createItem()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DEFAULT_CITY = 70;
const DEFAULT_REGION = 30;
