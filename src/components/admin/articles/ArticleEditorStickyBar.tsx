"use client";

import Link from "next/link";
import { AlertCircle, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ArticleStickyBarStatus = "dirty" | "saving" | "saved" | "error";

export interface ArticleStickyBarApproveAction {
  label: string;
  disabled: boolean;
  disabledReason: string | null;
  loading: boolean;
  onClick: () => void;
}

export interface ArticleEditorStickyBarProps {
  status: ArticleStickyBarStatus;
  statusLabel: string;
  onSave: () => void;
  saveDisabled: boolean;
  saving: boolean;
  /** null — действие «Одобрить» недоступно для текущего статуса/permissions (та же логика, что и в верхнем PublicationPanel). */
  approveAction: ArticleStickyBarApproveAction | null;
  previewHref: string | null;
  publicUrl: string | null;
}

/**
 * Компактный sticky bottom bar для длинных статей: дублирует статус
 * autosave-состояния (dirty/saving/saved/error) и действия Предпросмотр /
 * Открыть на сайте из верхнего PublicationPanel, чтобы не скроллить наверх.
 * Появляется только после первого пользовательского изменения — управляется
 * условным рендером в ArticleEditorClient, не мимикрирует собственную autosave-логику.
 */
export function ArticleEditorStickyBar({
  status,
  statusLabel,
  onSave,
  saveDisabled,
  saving,
  approveAction,
  previewHref,
  publicUrl,
}: ArticleEditorStickyBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:left-[260px]",
        "border-t border-gray-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
      )}
    >
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="flex h-14 max-w-4xl items-center justify-between gap-3 overflow-x-auto px-6 md:px-4">
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "inline-flex min-w-0 shrink items-center gap-1.5 truncate text-xs font-medium",
              status === "error" ? "text-red-600" : "text-muted-foreground",
            )}
          >
            {status === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            ) : null}
            {status === "saved" ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : null}
            {status === "error" ? <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{statusLabel}</span>
          </span>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={onSave} disabled={saveDisabled}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Сохранить
            </Button>

            {approveAction != null ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={approveAction.onClick}
                disabled={approveAction.disabled}
                title={approveAction.disabledReason ?? undefined}
              >
                {approveAction.loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                {approveAction.label}
              </Button>
            ) : null}

            {previewHref != null ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href={previewHref} target="_blank" rel="noopener noreferrer">
                  Предпросмотр
                </Link>
              </Button>
            ) : null}

            {publicUrl != null ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Открыть на сайте
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
