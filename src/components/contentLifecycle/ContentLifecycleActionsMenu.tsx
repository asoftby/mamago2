"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  XCircle,
} from "lucide-react";
import type { ContentDependencyItem } from "@/lib/admin/contentDependencySummary";
import {
  getLifecycleDialogCopy,
  LIFECYCLE_DIALOG_COPY,
  type LifecycleConfirmDialogActionId,
} from "@/lib/contentLifecycle/contentLifecycleDialogCopy";
import {
  contentTypeSuccessMessage,
  resolveLifecycleActionRequest,
} from "@/lib/contentLifecycle/lifecycleActionResolver";
import type { LifecycleActionId } from "@/lib/contentLifecycle/lifecycleTypes";
import type {
  ContentLifecycleActionId,
  ContentLifecycleViewModel,
} from "@/lib/contentLifecycle/contentLifecycleViewModel";
import type {
  LifecycleContentType,
  LifecycleSurface,
} from "@/lib/contentLifecycle/lifecycleTypes";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavigationLinks = {
  edit?: { href: string; label?: string };
  preview?: { href: string; label?: string; newTab?: boolean };
  review?: { href: string; label?: string };
};

type DeletePreflightExtras = {
  deleteDraft?: {
    blockedDialog?: {
      title: string;
      description?: string;
      items: ContentDependencyItem[];
    } | null;
    cascadeNote?: string | null;
  };
  deleteArchived?: {
    blockedDialog?: {
      title: string;
      description?: string;
      items: ContentDependencyItem[];
    } | null;
  };
};

type Props = {
  viewModel: ContentLifecycleViewModel;
  contentId: string;
  contentType: LifecycleContentType;
  surface: LifecycleSurface;
  links?: NavigationLinks;
  /** Show edit/preview/review as icon shortcuts beside the menu. */
  shortcutIcons?: boolean;
  deletePreflight?: DeletePreflightExtras;
  align?: "start" | "end";
  className?: string;
  onActionSuccess?: () => void;
};

function iconForAction(id: LifecycleActionId) {
  switch (id) {
    case "edit":
      return Pencil;
    case "preview":
      return Eye;
    case "review":
      return ShieldCheck;
    case "archive":
      return Archive;
    case "restore":
      return RotateCcw;
    case "deleteDraft":
    case "deleteArchived":
      return Trash2;
    case "publish":
      return Upload;
    case "submitForModeration":
      return Send;
    case "withdrawFromModeration":
      return Undo2;
    case "approve":
      return CheckCircle2;
    case "reject":
      return XCircle;
    default:
      return null;
  }
}

export function ContentLifecycleActionsMenu({
  viewModel,
  contentId,
  contentType,
  surface,
  links,
  shortcutIcons = true,
  deletePreflight,
  align = "start",
  className,
  onActionSuccess,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<LifecycleActionId | null>(
    null,
  );
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedAction, setBlockedAction] = useState<LifecycleActionId | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const transitionActions = viewModel.transitionActions;
  const hasMenuItems = transitionActions.length > 0;

  const blockedDialogForAction = (actionId: LifecycleActionId) => {
    if (actionId === "deleteDraft") {
      return deletePreflight?.deleteDraft?.blockedDialog ?? null;
    }
    if (actionId === "deleteArchived") {
      return deletePreflight?.deleteArchived?.blockedDialog ?? null;
    }
    return null;
  };

  const iconButtonClass = cn(
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
    "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
    "disabled:pointer-events-none disabled:opacity-50",
  );

  const blockedDialog =
    blockedAction != null ? blockedDialogForAction(blockedAction) : null;

  const dialogCopy: ReturnType<typeof getLifecycleDialogCopy> | null =
    confirmAction &&
    confirmAction !== "edit" &&
    confirmAction !== "preview" &&
    confirmAction !== "review"
      ? getLifecycleDialogCopy(confirmAction as LifecycleConfirmDialogActionId)
      : null;

  const activeRequest =
    confirmAction && confirmAction !== "edit" && confirmAction !== "preview" && confirmAction !== "review"
      ? resolveLifecycleActionRequest({
          surface,
          contentType,
          contentId,
          actionId: confirmAction,
        })
      : null;

  const handleMutation = async () => {
    if (!confirmAction || !activeRequest) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(activeRequest.url, {
        method: activeRequest.method,
        headers:
          activeRequest.body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body:
          activeRequest.body !== undefined
            ? JSON.stringify(activeRequest.body)
            : undefined,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
          code?: string;
          dependencySummary?: { items?: ContentDependencyItem[] };
        };
        const dependencyHint =
          payload.dependencySummary?.items
            ?.filter((item) => item.blocking && item.count > 0)
            .map((item) => `${item.label}: ${item.count}`)
            .join(" · ") ?? "";
        const baseMessage =
          payload.message ??
          payload.error ??
          payload.code ??
          "Не удалось выполнить действие";
        throw new Error(
          dependencyHint ? `${baseMessage}\n${dependencyHint}` : baseMessage,
        );
      }

      const action = transitionActions.find((item) => item.id === confirmAction);
      const fallbackSuccess = contentTypeSuccessMessage(contentType, confirmAction);
      toast.success(action?.label ? `${action.label}: готово` : fallbackSuccess ?? "Готово");
      setConfirmAction(null);
      router.refresh();
      onActionSuccess?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось выполнить действие",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransitionClick = (actionId: ContentLifecycleActionId) => {
    setMenuOpen(false);
    const action = transitionActions.find((item) => item.id === actionId);
    if (!action) return;

    if (action.disabled) {
      const actionBlockedDialog = blockedDialogForAction(actionId);
      if (
        (actionId === "deleteDraft" || actionId === "deleteArchived") &&
        actionBlockedDialog
      ) {
        setBlockedAction(actionId);
        setBlockedOpen(true);
        return;
      }
      if (action.reason) {
        toast.error(action.reason);
      }
      return;
    }

    const request = resolveLifecycleActionRequest({
      surface,
      contentType,
      contentId,
      actionId,
    });

    if (!request) {
      toast.error("Действие временно недоступно");
      return;
    }

    setConfirmAction(actionId);
  };

  const confirmDestructive =
    confirmAction === "deleteDraft" ||
    confirmAction === "deleteArchived" ||
    confirmAction === "archive" ||
    confirmAction === "reject";

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1",
          align === "end" ? "justify-end" : "justify-start",
          className,
        )}
      >
        {shortcutIcons && links?.edit ? (
          <Link
            href={links.edit.href}
            className={iconButtonClass}
            aria-label={links.edit.label ?? "Редактировать"}
            title={links.edit.label ?? "Редактировать"}
          >
            <Pencil className="h-4 w-4" />
          </Link>
        ) : null}
        {shortcutIcons && links?.preview ? (
          <a
            href={links.preview.href}
            target={links.preview.newTab ? "_blank" : undefined}
            rel={links.preview.newTab ? "noopener noreferrer" : undefined}
            className={iconButtonClass}
            aria-label={links.preview.label ?? "Просмотреть"}
            title={links.preview.label ?? "Просмотреть"}
          >
            <Eye className="h-4 w-4" />
          </a>
        ) : null}
        {shortcutIcons && links?.review ? (
          <Link
            href={links.review.href}
            className={iconButtonClass}
            aria-label={links.review.label ?? "Модерация"}
            title={links.review.label ?? "Модерация"}
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>
        ) : null}

        {hasMenuItems ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={iconButtonClass}
                aria-label="Действия"
                title="Действия"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align === "end" ? "end" : "start"} className="w-56">
              {transitionActions.map((action) => {
                const Icon = iconForAction(action.id);
                const actionBlockedDialog = blockedDialogForAction(action.id);
                const allowDisabledClick =
                  (action.id === "deleteDraft" || action.id === "deleteArchived") &&
                  action.disabled &&
                  Boolean(actionBlockedDialog);
                const isDisabled =
                  isSubmitting || (action.disabled && !allowDisabledClick);
                return (
                  <DropdownMenuItem
                    key={action.id}
                    disabled={isDisabled}
                    title={action.reason}
                    className={cn(
                      action.destructive && "text-red-600 focus:text-red-600",
                      action.disabled && "opacity-80",
                    )}
                    onClick={() => handleTransitionClick(action.id)}
                  >
                    {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                    <span className="flex min-w-0 flex-col">
                      <span>{action.label}</span>
                      {action.reason && action.disabled && !allowDisabledClick ? (
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {action.reason}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {blockedDialog ? (
        <AlertDialog
          open={blockedOpen}
          onOpenChange={(open) => {
            setBlockedOpen(open);
            if (!open) setBlockedAction(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {blockedDialog.title || LIFECYCLE_DIALOG_COPY.blocked.title}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  {blockedDialog.description ? (
                    <p>{blockedDialog.description}</p>
                  ) : null}
                  {blockedDialog.items.length > 0 ? (
                    <ul className="space-y-1.5">
                      {blockedDialog.items.map((item) => (
                        <li key={item.type}>
                          • {item.label}: {item.count}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p>Сначала удалите или отвяжите связанные записи.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                type="button"
                onClick={() => {
                  setBlockedOpen(false);
                  setBlockedAction(null);
                }}
              >
                Понятно
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {dialogCopy && activeRequest ? (
        <AlertDialog
          open={confirmAction !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialogCopy.title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{dialogCopy.description}</p>
                  {confirmAction === "deleteDraft" &&
                  deletePreflight?.deleteDraft?.cascadeNote ? (
                    <p>{deletePreflight.deleteDraft.cascadeNote}</p>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Отмена</AlertDialogCancel>
              <Button
                type="button"
                variant={confirmDestructive ? "destructive" : "default"}
                disabled={isSubmitting}
                onClick={() => void handleMutation()}
              >
                {isSubmitting ? "Выполняем..." : dialogCopy.confirmLabel}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
