"use client";

import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { ContentStatus, type GeoScope } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAuthorPicker } from "@/components/admin/publications/UserAuthorPicker";
import {
  PublicationGeoScopeField,
  type PublicationGeoScopeCity,
} from "@/components/admin/publications/PublicationGeoScopeField";
import { useHydrated } from "@/hooks/use-hydrated";
import { sameOriginUrl } from "@/lib/client/sameOriginUrl";
import { cn } from "@/lib/utils";
import { resolveArticlePublicationActionPolicy } from "./articlePublicationActionPolicy";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: ContentStatus[] = [
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "SCHEDULED",
  "ARCHIVED",
];

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
  SCHEDULED: "Запланировано",
  ARCHIVED: "В архиве",
};

export function statusBadgeClass(s: ContentStatus): string {
  switch (s) {
    case "PUBLISHED":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "PENDING":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "DRAFT":
      return "bg-slate-100 text-slate-800 border-slate-200";
    case "REJECTED":
      return "bg-red-100 text-red-900 border-red-200";
    case "SCHEDULED":
      return "bg-sky-100 text-sky-900 border-sky-200";
    case "ARCHIVED":
      return "bg-gray-200 text-gray-800 border-gray-300";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicationPanelProps {
  /** Счётчик просмотров, если доступен. */
  views?: number;
  /** Строка «Сохранено X назад» / «Изменения не сохранены», если доступна. */
  saveStatusLabel?: string | null;

  // Status
  status: ContentStatus;
  onStatusChange: (s: ContentStatus) => void;
  /** Список доступных статусов. По умолчанию — все ContentStatus. */
  statusOptions?: ContentStatus[];

  // Dates
  scheduledAtLocal: string;
  publishedAtLocal: string;
  onScheduledAtChange: (v: string) => void;
  onPublishedAtChange: (v: string) => void;

  // Author
  authorUserId: string | null;
  onAuthorChange: (id: string | null) => void;
  authorError?: string | null;
  /**
   * Опциональное поле «Отображаемое имя автора» — показывается только если передан
   * onAuthorLabelChange (актуально для обычных статей, не для breaking news).
   */
  authorLabel?: string;
  onAuthorLabelChange?: (v: string) => void;

  // Action state
  canModerate: boolean;
  hasUnsavedChanges: boolean;
  actionsBusy: boolean;
  submitting: boolean;
  saving: boolean;
  moderating?: boolean;

  // Action callbacks
  onSubmitForModeration: () => void;
  onSaveDraft: () => void;
  onApprove?: () => void;
  onReject?: () => void;

  // URLs
  /**
   * Ссылка для предпросмотра черновика. Если null — кнопка «Предпросмотр» disabled.
   */
  previewHref?: string | null;
  /**
   * Публичный URL опубликованной записи. Если null — кнопка «Смотреть на сайте» disabled.
   */
  publicUrl?: string | null;

  /** География публикации (опционально — для breaking news и др.). */
  geoScope?: GeoScope | null;
  onGeoScopeChange?: (scope: GeoScope | null) => void;
  cityId?: string | null;
  onCityIdChange?: (id: string | null) => void;
  cities?: PublicationGeoScopeCity[];
  geoScopeError?: string | null;
  onGeoScopeErrorClear?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublicationPanel({
  views,
  saveStatusLabel,
  status,
  onStatusChange,
  statusOptions = STATUS_OPTIONS,
  scheduledAtLocal,
  publishedAtLocal,
  onScheduledAtChange,
  onPublishedAtChange,
  authorUserId,
  onAuthorChange,
  authorError,
  authorLabel,
  onAuthorLabelChange,
  canModerate,
  hasUnsavedChanges,
  actionsBusy,
  submitting,
  saving,
  moderating = false,
  onSubmitForModeration,
  onSaveDraft,
  onApprove,
  onReject,
  previewHref,
  publicUrl,
  geoScope,
  onGeoScopeChange,
  cityId,
  onCityIdChange,
  cities = [],
  geoScopeError,
  onGeoScopeErrorClear,
}: PublicationPanelProps) {
  const hydrated = useHydrated();
  const resolvedPublicUrl = hydrated && publicUrl ? sameOriginUrl(publicUrl) : publicUrl;
  const showGeoScopeField = onGeoScopeChange != null;
  const actionPolicy = resolveArticlePublicationActionPolicy({
    status,
    canModerate,
    hasUnsavedChanges,
    hasPublicUrl: resolvedPublicUrl != null,
  });

  const metaParts: string[] = [];
  if (views != null) metaParts.push(`Просмотры: ${views}`);
  if (saveStatusLabel) metaParts.push(saveStatusLabel);

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Публикация</CardTitle>
        {metaParts.length > 0 ? (
          <CardDescription>{metaParts.join(" · ")}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {showGeoScopeField ? (
          <PublicationGeoScopeField
            geoScope={geoScope ?? null}
            onGeoScopeChange={onGeoScopeChange}
            cityId={cityId ?? null}
            onCityIdChange={onCityIdChange ?? (() => {})}
            cities={cities}
            error={geoScopeError}
            onErrorClear={onGeoScopeErrorClear}
            disabled={actionsBusy}
          />
        ) : null}

        {/* ── Автор ── */}
        <div className="space-y-1.5">
          <Label>Автор публикации</Label>
          <UserAuthorPicker
            value={authorUserId}
            onChange={onAuthorChange}
            error={authorError}
            disabled={actionsBusy}
          />
        </div>

        {/* ── Отображаемое имя автора (только для статей с authorLabel) ── */}
        {onAuthorLabelChange != null ? (
          <div className="space-y-1.5">
            <Label>Отображаемое имя автора</Label>
            <Input
              value={authorLabel ?? ""}
              onChange={(e) => onAuthorLabelChange(e.target.value)}
              placeholder="Необязательно: подпись на сайте вместо имени пользователя"
              disabled={actionsBusy}
            />
            <p className="text-xs text-muted-foreground">
              Если пусто, на сайте показывается имя выбранного пользователя.
            </p>
          </div>
        ) : null}

        {/* ── Статус ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Статус</Label>
            {hydrated ? (
              <Select value={status} onValueChange={(v) => onStatusChange(v as ContentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div
                className={cn(
                  "flex h-9 min-w-[10rem] items-center rounded-md border border-input",
                  "bg-muted/40 px-3 text-sm text-muted-foreground animate-pulse",
                )}
                aria-hidden
              >
                …
              </div>
            )}
          </div>
        </div>

        {/* ── Даты ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Запланировано (scheduledAt)</Label>
            <Input
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => onScheduledAtChange(e.target.value)}
              disabled={actionsBusy}
            />
          </div>
          <div className="space-y-2">
            <Label>Опубликовано (publishedAt)</Label>
            <Input
              type="datetime-local"
              value={publishedAtLocal}
              onChange={(e) => onPublishedAtChange(e.target.value)}
              disabled={actionsBusy}
            />
          </div>
        </div>

        {/* ── Контекстные действия ── */}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {actionPolicy.primary?.kind === "submit" ? (
              <Button type="button" onClick={onSubmitForModeration} disabled={actionsBusy}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {actionPolicy.primary.label}
              </Button>
            ) : null}

            {actionPolicy.primary?.kind === "approve" && onApprove && onReject ? (
              <>
                <Button
                  type="button"
                  onClick={onApprove}
                  disabled={actionsBusy || actionPolicy.primary.disabled}
                  title={actionPolicy.primary.disabled ? (actionPolicy.primary.disabledReason ?? undefined) : undefined}
                >
                  {moderating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {moderating ? "Одобрение…" : actionPolicy.primary.label}
                </Button>
                <Button type="button" variant="destructive" onClick={onReject} disabled={actionsBusy}>
                  {moderating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Отклонить
                </Button>
              </>
            ) : null}

            {actionPolicy.primary?.kind === "save" ? (
              <Button
                type="button"
                onClick={onSaveDraft}
                disabled={actionsBusy || actionPolicy.primary.disabled}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {actionPolicy.primary.label}
              </Button>
            ) : null}

            {actionPolicy.showQuietSave ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={onSaveDraft}
                disabled={actionsBusy || !hasUnsavedChanges}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Сохранить
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {previewHref != null ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href={previewHref} target="_blank" rel="noopener noreferrer">
                  Предпросмотр
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                disabled
                title="Сохраните запись, чтобы открыть предпросмотр."
              >
                Предпросмотр
              </Button>
            )}

            {actionPolicy.showPublicLink && resolvedPublicUrl != null ? (
              <Button
                type="button"
                variant="outline"
                className="text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href={resolvedPublicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Открыть на сайте
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
