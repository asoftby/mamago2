"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

type ModerationKind = "PLACE" | "PLACE_UPDATE" | "EVENT" | "OFFER";

type Props = {
  item: {
    id: string;
    moderationId: string;
    kind: ModerationKind;
    title: string;
    reviewHref: string;
  };
  onResolved: (rowKey: string) => void;
};

function getModerationEndpoint(item: Props["item"]): string {
  if (item.kind === "PLACE") {
    return `/api/admin/moderation/places/${item.moderationId}`;
  }
  if (item.kind === "PLACE_UPDATE") {
    return `/api/admin/moderation/revisions/${item.moderationId}`;
  }
  if (item.kind === "EVENT") {
    return `/api/admin/moderation/events/${item.moderationId}`;
  }
  return `/api/admin/moderation/offers/${item.moderationId}`;
}

function getRejectPlaceholder(kind: ModerationKind): string {
  if (kind === "PLACE") return "Например: недостаточно данных для публикации.";
  if (kind === "PLACE_UPDATE") return "Например: правки требуют доработки перед публикацией.";
  if (kind === "EVENT") return "Например: событие не прошло проверку качества.";
  return "Например: предложение не соответствует правилам публикации.";
}

export function ModerationQueueRowActions({ item, onResolved }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const endpoint = useMemo(() => getModerationEndpoint(item), [item]);

  const handleModeration = async (action: "APPROVE" | "REJECT" | "NEEDS_REVISION", reason?: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          comment:
            action === "REJECT"
              ? reason?.trim() || "Отклонено модератором."
              : action === "NEEDS_REVISION" ? reason?.trim() : undefined,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Не удалось выполнить действие");
      }

      onResolved(`${item.kind}:${item.id}`);
      router.refresh();
      toast.success(action === "APPROVE" ? "Публикация одобрена" : action === "NEEDS_REVISION" ? "Публикация возвращена на доработку" : "Публикация отклонена");
      if (action === "NEEDS_REVISION") {
        setRevisionOpen(false);
        setRevisionReason("");
      }
      if (action === "REJECT") {
        setRejectOpen(false);
        setRejectReason("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка модерации");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href={item.reviewHref}
          className="text-sm font-medium text-stone-600 transition hover:text-stone-950 hover:underline"
        >
          Открыть
        </Link>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleModeration("APPROVE")}
          disabled={isSubmitting}
          className="min-w-[112px]"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Опубликовать
        </Button>
        {item.kind === "OFFER" ? (
          <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={() => setRevisionOpen(true)}>
            Запросить правки
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => setRejectOpen(true)}
          className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        >
          Отклонить
        </Button>
      </div>

      <AlertDialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вернуть предложение на доработку?</AlertDialogTitle>
            <AlertDialogDescription>
              Бизнес получит замечание и сможет исправить предложение перед повторной модерацией.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor={`revision-reason-${item.id}`} className="text-sm font-medium text-stone-800">
              Что необходимо исправить
            </label>
            <Textarea
              id={`revision-reason-${item.id}`}
              value={revisionReason}
              onChange={(event) => setRevisionReason(event.target.value)}
              placeholder="Например: укажите цену или выберите «Цена по запросу»."
              className="min-h-[88px] resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Отмена</AlertDialogCancel>
            <Button type="button" size="sm" disabled={isSubmitting || !revisionReason.trim()} onClick={() => void handleModeration("NEEDS_REVISION", revisionReason)}>
              Запросить правки
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить публикацию?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись уйдёт из очереди модерации. Причину можно оставить коротко, без лишней формальности.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label htmlFor={`reject-reason-${item.id}`} className="text-sm font-medium text-stone-800">
              Причина
            </label>
            <Textarea
              id={`reject-reason-${item.id}`}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={getRejectPlaceholder(item.kind)}
              className="min-h-[88px] resize-none"
            />
            <p className="text-xs text-stone-500">
              Если поле оставить пустым, будет использована короткая системная причина.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Отмена</AlertDialogCancel>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => void handleModeration("REJECT", rejectReason)}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Отклонить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
