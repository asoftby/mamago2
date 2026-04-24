"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { ContentStatus } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigateToSurface } from "@/lib/routing/clientNavigation";

type Props = {
  eventId: string;
  status: ContentStatus;
  returnTo: string;
};

function deleteCopy(status: ContentStatus): { title: string; description: string } {
  if (status === ContentStatus.PUBLISHED) {
    return {
      title: "Удалить опубликованное событие?",
      description: "Оно перестанет отображаться пользователям.",
    };
  }
  return {
    title: "Удалить событие?",
    description: "Это действие нельзя отменить.",
  };
}

export function AdminEventRowActions({ eventId, status, returnTo }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (status === ContentStatus.DELETED) {
    return null;
  }

  const copy = deleteCopy(status);
  const editHref = `/editor/event/${eventId}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/moderation/events/${eventId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Не удалось удалить событие");
      }
      toast.success("Событие удалено из каталога");
      setOpen(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не получилось выполнить действие");
    } finally {
      setLoading(false);
    }
  };

  const iconBtn =
    "inline-flex items-center justify-center rounded-md p-1.5 transition-colors shrink-0 text-gray-500 hover:text-gray-900 hover:bg-gray-100";

  return (
    <div className="flex items-center gap-0.5">
      <Link href={editHref} className={iconBtn} title="Редактировать" aria-label="Редактировать">
        <Pencil className="w-4 h-4" />
      </Link>
      <button
        type="button"
        onClick={() =>
          navigateToSurface(router, {
            targetSurface: "public",
            targetPath: `/me/events/${eventId}/preview`,
          })
        }
        className={iconBtn}
        title="Просмотр"
        aria-label="Просмотр как для пользователя"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md p-1.5 transition-colors shrink-0",
          "text-gray-400 hover:text-red-600 hover:bg-red-50",
          "disabled:opacity-50 disabled:pointer-events-none"
        )}
        title="Удалить событие"
        aria-label="Удалить событие"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={() => void handleDelete()}
            >
              {loading ? "Удаление…" : "Удалить"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
