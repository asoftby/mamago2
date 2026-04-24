"use client";

import { useState } from "react";
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

type ModerationResolution = "PUBLISHED" | "REJECTED" | null;

interface Props {
  activityId: string;
}

export function ActivityModerationShortcut({ activityId }: Props) {
  const router = useRouter();
  const [resolution, setResolution] = useState<ModerationResolution>(null);
  const [loadingAction, setLoadingAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function submitModeration(action: "APPROVE" | "REJECT", comment?: string) {
    setLoadingAction(action);
    try {
      const response = await fetch(`/api/admin/moderation/events/${activityId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          comment: action === "REJECT" ? comment?.trim() || "Отклонено после import review." : undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Не удалось выполнить действие модерации");
      }

      const nextResolution = action === "APPROVE" ? "PUBLISHED" : "REJECTED";
      setResolution(nextResolution);
      if (action === "REJECT") {
        setRejectOpen(false);
        setRejectReason("");
      }
      toast.success(action === "APPROVE" ? "Activity опубликован" : "Activity отклонён");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка модерации");
    } finally {
      setLoadingAction(null);
    }
  }

  if (resolution === "PUBLISHED") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
        Опубликовано
      </div>
    );
  }

  if (resolution === "REJECTED") {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
        Отклонено
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href={`/editor/event/${activityId}/edit`}>Открыть карточку</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingAction !== null}
          onClick={() => void submitModeration("APPROVE")}
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        >
          {loadingAction === "APPROVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Опубликовать
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingAction !== null}
          onClick={() => setRejectOpen(true)}
          className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        >
          Отклонить
        </Button>
      </div>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить Activity?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет выполнено то же действие модерации, что и в очереди. Можно оставить короткую причину.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label htmlFor={`reject-activity-${activityId}`} className="text-sm font-medium text-stone-800">
              Причина
            </label>
            <Textarea
              id={`reject-activity-${activityId}`}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Например: событие пока не готово к публикации."
              className="min-h-[88px] resize-none"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingAction !== null}>Отмена</AlertDialogCancel>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={loadingAction !== null}
              onClick={() => void submitModeration("REJECT", rejectReason)}
            >
              {loadingAction === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Отклонить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
