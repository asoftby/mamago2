"use client";

import { useRouter } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { navigateToSurface } from "@/lib/routing/clientNavigation";
import { AdminContentRowActions } from "@/components/admin/content/AdminContentRowActions";

type Props = {
  eventId: string;
  status: ContentStatus;
  returnTo: string;
  publicHref?: string | null;
};

function deleteCopy(): { title: string; description: string } {
  return {
    title: "Удалить черновик?",
    description: "Это действие нельзя отменить.",
  };
}

export function AdminEventRowActions({ eventId, status, returnTo, publicHref }: Props) {
  const router = useRouter();

  if (status === ContentStatus.DELETED) {
    return null;
  }

  const copy = deleteCopy();
  const isDraft = status === ContentStatus.DRAFT;
  const editHref = `/editor/event/${eventId}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AdminContentRowActions
      editAction={{
        icon: "edit",
        href: editHref,
        label: "Редактировать событие",
        title: "Редактировать",
      }}
      viewAction={{
        icon: "view",
        label: publicHref ? "Открыть публичную страницу" : "Открыть предпросмотр",
        title: publicHref ? "Открыть публичную страницу" : "Открыть предпросмотр",
        onClick: () => {
          if (publicHref) {
            window.open(publicHref, "_blank", "noopener,noreferrer");
            return;
          }

          navigateToSurface(router, {
            targetSurface: "public",
            targetPath: `/me/events/${eventId}/preview`,
          });
        },
      }}
      destructiveAction={{
        kind: isDraft ? "hardDelete" : "archive",
        label: isDraft ? "Удалить черновик" : "Архивировать",
        title: isDraft ? copy.title : "Переместить в архив?",
        description: isDraft
          ? copy.description
          : "Публикация будет скрыта. Восстановление возможно.",
        request: {
          url: isDraft
            ? `/api/admin/moderation/events/${eventId}`
            : `/api/business/events/${eventId}/archive`,
          method: isDraft ? "DELETE" : "POST",
        },
        confirmLabel: isDraft ? "Удалить" : "Архивировать",
        successMessage: isDraft
          ? "Черновик события удалён"
          : "Событие перемещено в архив",
        errorMessage: isDraft
          ? "Не удалось удалить черновик"
          : "Не удалось архивировать событие",
      }}
      align="end"
    />
  );
}
