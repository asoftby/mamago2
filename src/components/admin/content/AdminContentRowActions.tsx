"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Eye,
  Loader2,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
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
import type { ContentDependencyItem } from "@/lib/admin/contentDependencySummary";

type ActionIcon = "edit" | "view" | "review";
type MutationKind = "archive" | "restore" | "softDelete" | "hardDelete";

type BaseAction = {
  label: string;
  title?: string;
  disabled?: boolean;
};

type LinkAction = BaseAction & {
  icon: ActionIcon;
  href?: string | null;
  onClick?: () => void;
  newTab?: boolean;
};

type BlockedDialog = {
  title: string;
  description?: string;
  items: ContentDependencyItem[];
};

type MutationAction = {
  kind: MutationKind;
  label: string;
  title: string;
  description: string;
  request: {
    url: string;
    method?: "POST" | "PATCH" | "DELETE";
    body?: unknown;
  };
  confirmLabel?: string;
  successMessage: string;
  errorMessage?: string;
  disabled?: boolean;
  blockedDialog?: BlockedDialog | null;
  cascadeNote?: string | null;
};

type Props = {
  editAction?: LinkAction | null;
  viewAction?: LinkAction | null;
  reviewAction?: LinkAction | null;
  destructiveAction?: MutationAction | null;
  align?: "start" | "end";
  className?: string;
  onActionSuccess?: () => void;
};

function iconForAction(icon: ActionIcon) {
  switch (icon) {
    case "edit":
      return Pencil;
    case "review":
      return ShieldCheck;
    case "view":
    default:
      return Eye;
  }
}

function iconForMutation(kind: MutationKind) {
  switch (kind) {
    case "archive":
      return Archive;
    case "restore":
      return RotateCcw;
    case "softDelete":
    case "hardDelete":
    default:
      return Trash2;
  }
}

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

function isRestoreAction(kind: MutationKind) {
  return kind === "restore";
}

export function AdminContentRowActions({
  editAction,
  viewAction,
  reviewAction,
  destructiveAction,
  align = "start",
  className,
  onActionSuccess,
}: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const iconButtonClass = cn(
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
    "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
    "disabled:pointer-events-none disabled:opacity-50",
  );

  const renderLinkAction = (action: LinkAction | null | undefined) => {
    if (!action || (!action.href && !action.onClick)) {
      return null;
    }

    const Icon = iconForAction(action.icon);
    const title = action.title ?? action.label;
    const disabled = isSubmitting || action.disabled;

    if (action.onClick) {
      return (
        <button
          key={`${action.icon}-${title}`}
          type="button"
          disabled={disabled}
          onClick={action.onClick}
          className={iconButtonClass}
          aria-label={action.label}
          title={title}
        >
          <Icon className="h-4 w-4" />
        </button>
      );
    }

    if (!action.href) {
      return null;
    }

    const commonProps = {
      "aria-label": action.label,
      className: cn(iconButtonClass, disabled && "pointer-events-none opacity-50"),
      title,
    };

    if (disabled) {
      return (
        <span
          key={`${action.icon}-${title}`}
          role="img"
          aria-label={action.label}
          className={commonProps.className}
          title={title}
        >
          <Icon className="h-4 w-4" />
        </span>
      );
    }

    if (action.newTab || isExternalHref(action.href)) {
      return (
        <a
          key={`${action.icon}-${title}`}
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          {...commonProps}
        >
          <Icon className="h-4 w-4" />
        </a>
      );
    }

    return (
      <Link key={`${action.icon}-${title}`} href={action.href} {...commonProps}>
        <Icon className="h-4 w-4" />
      </Link>
    );
  };

  const handleMutation = async () => {
    if (!destructiveAction) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(destructiveAction.request.url, {
        method: destructiveAction.request.method ?? "POST",
        headers:
          destructiveAction.request.body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body:
          destructiveAction.request.body !== undefined
            ? JSON.stringify(destructiveAction.request.body)
            : undefined,
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
          message?: string;
          dependencySummary?: {
            items?: ContentDependencyItem[];
          };
        };
        const dependencyHint =
          payload.dependencySummary?.items
            ?.filter((item) => item.blocking && item.count > 0)
            .map((item) => `${item.label}: ${item.count}`)
            .join(" · ") ?? "";
        const baseMessage =
          typeof payload.message === "string"
            ? payload.message
            : typeof payload.error === "string"
              ? payload.error
              : typeof payload.code === "string"
                ? payload.code
                : destructiveAction.errorMessage || "Не удалось выполнить действие";
        throw new Error(
          dependencyHint ? `${baseMessage}\n${dependencyHint}` : baseMessage,
        );
      }

      toast.success(destructiveAction.successMessage);
      setConfirmOpen(false);
      router.refresh();
      onActionSuccess?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : destructiveAction.errorMessage || "Не удалось выполнить действие",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const MutationIcon = destructiveAction ? iconForMutation(destructiveAction.kind) : null;
  const restoreAction = destructiveAction
    ? isRestoreAction(destructiveAction.kind)
    : false;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1",
          align === "end" ? "justify-end" : "justify-start",
          className,
        )}
      >
        {renderLinkAction(editAction)}
        {renderLinkAction(viewAction)}
        {renderLinkAction(reviewAction)}
        {destructiveAction ? (
          <button
            type="button"
            disabled={isSubmitting || destructiveAction.disabled}
            onClick={() => {
              if (destructiveAction.blockedDialog) {
                setBlockedOpen(true);
                return;
              }
              setConfirmOpen(true);
            }}
            className={cn(
              iconButtonClass,
              restoreAction
                ? "text-gray-500 hover:bg-emerald-50 hover:text-emerald-700"
                : "text-gray-400 hover:bg-red-50 hover:text-red-600",
            )}
            aria-label={destructiveAction.label}
            title={destructiveAction.label}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : MutationIcon ? (
              <MutationIcon className="h-4 w-4" />
            ) : null}
          </button>
        ) : null}
      </div>

      {destructiveAction?.blockedDialog ? (
        <AlertDialog open={blockedOpen} onOpenChange={setBlockedOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {destructiveAction.blockedDialog.title}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  {destructiveAction.blockedDialog.description ? (
                    <p>{destructiveAction.blockedDialog.description}</p>
                  ) : null}
                  {destructiveAction.blockedDialog.items.length > 0 ? (
                    <div>
                      <p className="font-medium text-foreground">
                        Связанные данные
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {destructiveAction.blockedDialog.items.map((item) => (
                          <li key={item.type} className="flex items-center gap-2">
                            <span aria-hidden="true">•</span>
                            <span>
                              {item.href ? (
                                <Link
                                  href={item.href}
                                  className="underline underline-offset-2"
                                >
                                  {item.label}
                                </Link>
                              ) : (
                                item.label
                              )}
                              : {item.count}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-amber-700">
                              блокирует удаление
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3">
                        Сначала удалите или отвяжите связанные записи.
                      </p>
                    </div>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button type="button" onClick={() => setBlockedOpen(false)}>
                Понятно
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {destructiveAction && !destructiveAction.blockedDialog ? (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{destructiveAction.title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{destructiveAction.description}</p>
                  {destructiveAction.cascadeNote ? (
                    <p>{destructiveAction.cascadeNote}</p>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Отмена</AlertDialogCancel>
              <Button
                type="button"
                variant={restoreAction ? "default" : "destructive"}
                disabled={isSubmitting}
                onClick={() => void handleMutation()}
              >
                {isSubmitting
                  ? "Выполняем..."
                  : destructiveAction.confirmLabel ?? destructiveAction.label}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
