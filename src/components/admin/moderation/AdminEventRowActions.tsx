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

function deleteCopy(status: ContentStatus): { title: string; description: string } {
  if (status === ContentStatus.PUBLISHED) {
    return {
      title: "Удалить опубликованное событие?",
      description: "Событие будет снято с публикации и исчезнет из каталога для пользователей.",
    };
  }
  return {
    title: "Удалить событие?",
    description: "Событие будет скрыто из каталога. Статус изменится на удалённый.",
  };
}

export function AdminEventRowActions({ eventId, status, returnTo, publicHref }: Props) {
  const router = useRouter();

  if (status === ContentStatus.DELETED) {
    return null;
  }

  const copy = deleteCopy(status);
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
        kind: "softDelete",
        label: "Удалить",
        title: copy.title,
        description: copy.description,
        request: {
          url: `/api/admin/moderation/events/${eventId}`,
          method: "DELETE",
        },
        confirmLabel: "Удалить",
        successMessage: "Событие удалено из каталога",
        errorMessage: "Не удалось удалить событие",
      }}
      align="end"
    />
  );
}
