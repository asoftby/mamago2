"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Heart, MousePointerClick, Zap } from "lucide-react";
import { toast } from "sonner";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createDailyFreeBoostAction } from "@/app/business/(protected)/dashboard/actions";
import type { DashboardData } from "./DashboardClient";

type Props = {
  data: DashboardData["dailyFreeBoost"];
  initialTarget?: string;
};

export function DailyFreeBoostCard({ data, initialTarget }: Props) {
  const router = useRouter();
  const validInitialTarget = data.candidates.some(
    (candidate) => `${candidate.publicationType}:${candidate.id}` === initialTarget,
  ) ? initialTarget! : null;
  const [open, setOpen] = useState(Boolean(validInitialTarget));
  const [selected, setSelected] = useState<string | null>(validInitialTarget);
  const nextFreeLabel = data.nextFreeAt
    ? new Intl.DateTimeFormat("ru-BY", {
        timeZone: "Europe/Minsk",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(data.nextFreeAt))
    : null;
  const [pending, startTransition] = useTransition();
  const selectedCandidate = data.candidates.find(
    (candidate) => `${candidate.publicationType}:${candidate.id}` === selected,
  );

  function submit() {
    if (!selectedCandidate) return;
    startTransition(async () => {
      const result = await createDailyFreeBoostAction({
        publicationId: selectedCandidate.id,
        publicationType: selectedCandidate.publicationType,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Публикация поднята в рекомендациях");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <BusinessSurfaceCard className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
            <Zap className="h-4 w-4 text-amber-500" />
          </span>
          <p className="text-sm font-semibold text-stone-900">
            Бесплатное продвижение
          </p>
        </div>

        {data.boost ? (
          <>
            <div>
              <p className="text-base font-semibold text-stone-900">
                Публикация поднята
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {data.boost.publicationTitle}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {nextFreeLabel
                  ? `Следующее бесплатное поднятие: ${nextFreeLabel} (Минск)`
                  : "Следующее бесплатное поднятие — через 24 часа"}
              </p>
              <button
                type="button"
                disabled={data.candidates.length === 0}
                onClick={() => setOpen(true)}
                className="mt-3 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-800 disabled:opacity-50"
              >
                Продвинуть другую публикацию
              </button>
            </div>

            <div className="border-t border-stone-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                За время поднятия
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric icon={Eye} value={data.boost.metrics.views} label="просмотров" />
                <Metric icon={Heart} value={data.boost.metrics.saves} label="сохранений" />
                <Metric
                  icon={MousePointerClick}
                  value={data.boost.metrics.ctaClicks}
                  label="переходов"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-base font-semibold text-stone-900">
                1 бесплатное поднятие доступно
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
                Поднимите одну публикацию на 24 часа в своём регионе. Место
                в выдаче зависит от актуальности и интересов семьи.
              </p>
            </div>
            <button
              type="button"
              disabled={data.candidates.length === 0}
              onClick={() => setOpen(true)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-400"
            >
              {data.candidates.length > 0
                ? "Выбрать публикацию"
                : "Нет доступных публикаций"}
            </button>
          </>
        )}
      </BusinessSurfaceCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Выберите публикацию</DialogTitle>
            <DialogDescription>
              Выберите событие или предложение. Бесплатно — один раз за 24 часа,
              дополнительные публикации — через платный Boost.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] space-y-2 overflow-y-auto py-2">
            {data.candidates.map((candidate) => {
              const key = `${candidate.publicationType}:${candidate.id}`;
              const active = selected === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition",
                    active
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:bg-stone-50",
                  )}
                >
                  <span className="block text-sm font-semibold text-stone-900">
                    {candidate.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-400">
                    {candidate.publicationType === "EVENT"
                      ? "Событие"
                      : "Предложение"}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!selectedCandidate || pending || !data.availableToday}
            onClick={submit}
            className="w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
          >
            {pending ? "Поднимаем…" : data.availableToday ? "Поднять бесплатно" : "Бесплатный Boost пока недоступен"}
          </button>
          {selectedCandidate ? (
            <Link
              href={`/business/${selectedCandidate.publicationType === "EVENT" ? "events" : "offers"}/${selectedCandidate.id}/boost`}
              className="block w-full rounded-xl border border-stone-200 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              Платный Boost
            </Link>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Eye;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-2.5">
      <Icon className="mx-auto h-3.5 w-3.5 text-stone-400" />
      <p className="mt-1 text-sm font-semibold tabular-nums text-stone-800">
        {value}
      </p>
      <p className="text-[10px] text-stone-400">{label}</p>
    </div>
  );
}
