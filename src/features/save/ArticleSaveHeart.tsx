"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { persistArticleSave } from "@/features/save/persistArticleSave";

export type ArticleSaveStatus = {
  isIdea: boolean;
  inPlan: boolean;
  planDate: string | null;
  planStartsAt: string | null;
  planItemId: string | null;
};

type ArticleSaveHeartProps = {
  articleId: string;
  articleTitle: string;
  coverImageUrl?: string | null;
  source?: string;
  className?: string;
  iconClassName?: string;
  /** "icon" — карточка (только сердце); "labeled" — detail (сердце + текст) */
  variant?: "icon" | "labeled";
  /**
   * Статус из батч-запроса родителя (карточные гриды). Может прийти позже
   * монтирования — компонент синхронизируется, когда проп обновится.
   */
  initialStatus?: ArticleSaveStatus;
  /**
   * true — родитель сам владеет батч-статусом (карточный грид): компонент
   * никогда не делает собственный GET на монтировании, чтобы не плодить
   * N+1 запросов на странице со множеством карточек. После реального
   * взаимодействия (открыл/закрыл chooser) статус для ЭТОЙ карточки всё
   * равно перепроверяется — это ограниченный, не N+1 запрос.
   */
  skipOwnFetch?: boolean;
};

function formatPlanDateRu(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function ArticleSaveHeart({
  articleId,
  articleTitle,
  coverImageUrl,
  source = "article",
  className,
  iconClassName,
  variant = "icon",
  initialStatus,
  skipOwnFetch = false,
}: ArticleSaveHeartProps) {
  const { isAuthenticated } = useAuthMe();
  const [flowOpen, setFlowOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ArticleSaveStatus>(
    initialStatus ?? {
      isIdea: false,
      inPlan: false,
      planDate: null,
      planStartsAt: null,
      planItemId: null,
    },
  );

  const isSaved = saveStatus.isIdea || saveStatus.inPlan;

  const checkSaveStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/save/status?articleId=${encodeURIComponent(articleId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSaveStatus({
        isIdea: Boolean(data.isIdea),
        inPlan: Boolean(data.inPlan),
        planDate: data.planDate ?? null,
        planStartsAt: data.planStartsAt ?? null,
        planItemId: data.planItemId ?? null,
      });
    } catch (error) {
      console.error("Failed to check article save status:", error);
    }
  }, [articleId]);

  // Батч-статус карточного грида может прийти позже монтирования — синхронизируем при обновлении пропа.
  useEffect(() => {
    if (initialStatus) setSaveStatus(initialStatus);
  }, [initialStatus]);

  // skipOwnFetch (карточный грид) — родитель сам владеет статусом, не дублируем его батч-запросом.
  useEffect(() => {
    if (skipOwnFetch) return;
    void checkSaveStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkSaveStatus]);

  useEffect(() => {
    if (flowOpen) {
      setHasOpenedOnce(true);
      return;
    }
    // На карточках не перепроверяем, пока пользователь реально не открыл chooser —
    // иначе это тот же N+1 на монтировании, только под другим триггером.
    if (skipOwnFetch && !hasOpenedOnce) return;
    void checkSaveStatus();
  }, [flowOpen, skipOwnFetch, hasOpenedOnce, checkSaveStatus]);

  const handlePersist = useCallback(
    async (result: SaveToPlanResult) => {
      setIsLoading(true);
      try {
        await persistArticleSave(result, {
          articleId,
          title: articleTitle,
          coverImageUrl,
        });

        if (result.action === "plan") {
          toast.success("Добавлено в план", {
            description: `На ${formatPlanDateRu(result.dateISO)}`,
          });
        } else if (result.action === "ideas") {
          toast.success("Сохранено в идеи", {
            description: "Вы сможете вернуться к статье позже",
          });
        } else if (result.action === "remove-idea") {
          toast.success("Убрано из идей");
        } else if (result.action === "remove-plan") {
          toast.success("Убрано из плана");
        }
      } catch {
        toast.error("Не получилось выполнить действие", {
          description: "Попробуйте ещё раз",
        });
        throw new Error("article_save_failed");
      } finally {
        setIsLoading(false);
      }
    },
    [articleId, articleTitle, coverImageUrl],
  );

  const handleHeartClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFlowOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleHeartClick}
        disabled={isLoading}
        aria-label={isSaved ? "Изменить сохранение статьи" : "Сохранить статью"}
        title={isSaved ? "Изменить сохранение" : "Сохранить"}
        className={cn(
          variant === "labeled"
            ? "inline-flex h-10 items-center gap-2 rounded-full border border-[rgba(20,18,16,0.14)] bg-white px-4 text-sm font-medium text-foreground transition-colors hover:border-[rgba(20,18,16,0.28)]"
            : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-105 active:scale-95",
          isSaved ? "text-primary" : "text-muted-foreground hover:text-primary",
          isLoading && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <Heart className={cn("h-4 w-4", isSaved && "fill-current", iconClassName)} />
        {variant === "labeled" ? <span>Сохранить</span> : null}
      </button>

      <SaveActivityFlowAdaptive
        open={flowOpen}
        onOpenChange={setFlowOpen}
        isAuthenticated={isAuthenticated}
        scenario={{
          kind: "quickdate",
          title: articleTitle,
        }}
        source={source}
        onPersist={handlePersist}
        isIdea={saveStatus.isIdea}
        inPlan={saveStatus.inPlan}
        planDate={saveStatus.planDate}
        planStartsAt={saveStatus.planStartsAt}
        planItemId={saveStatus.planItemId}
        pendingEntityType="article"
        pendingEntityId={articleId}
        activityTitle={articleTitle}
        coverImageUrl={coverImageUrl}
      />
    </>
  );
}
