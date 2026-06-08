"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  Upload,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  ReleaseListItem,
  ReleaseNoteInput,
  ReleaseNoteTypeValue,
} from "@/types/release";
import { cn } from "@/lib/utils";
import { randomId } from "@/lib/utils/randomId";

type ReleaseHistoryPanelProps = {
  initialReleases: ReleaseListItem[];
};

type NoteDraft = {
  key: string;
  type: ReleaseNoteTypeValue;
  title: string;
  description: string;
};

type ReleaseFormState = {
  version: string;
  title: string;
  notes: NoteDraft[];
};

const NOTE_TYPE_OPTIONS: Array<{
  value: ReleaseNoteTypeValue;
  label: string;
}> = [
  { value: "feature", label: "Фича" },
  { value: "fix", label: "Фикс" },
  { value: "improvement", label: "Улучшение" },
  { value: "security", label: "Безопасность" },
];

const NOTE_TYPE_LABEL: Record<ReleaseNoteTypeValue, string> = {
  feature: "Фича",
  fix: "Фикс",
  improvement: "Улучшение",
  security: "Безопасность",
};

const NOTE_TYPE_BADGE_CLASS: Record<ReleaseNoteTypeValue, string> = {
  feature: "bg-blue-100 text-blue-700",
  fix: "bg-rose-100 text-rose-700",
  improvement: "bg-amber-100 text-amber-700",
  security: "bg-green-100 text-green-700",
};

function createNoteDraft(
  partial?: Partial<NoteDraft>,
): NoteDraft {
  return {
    key: partial?.key ?? randomId(),
    type: partial?.type ?? "feature",
    title: partial?.title ?? "",
    description: partial?.description ?? "",
  };
}

function emptyFormState(): ReleaseFormState {
  return {
    version: "",
    title: "",
    notes: [],
  };
}

function releaseToFormState(release: ReleaseListItem): ReleaseFormState {
  return {
    version: release.version,
    title: release.title,
    notes: release.notes.map((note) =>
      createNoteDraft({
        key: note.id,
        type: note.type,
        title: note.title,
        description: note.description ?? "",
      }),
    ),
  };
}

function notesToPayload(notes: NoteDraft[]): ReleaseNoteInput[] {
  return notes.map((note) => ({
    type: note.type,
    title: note.title.trim(),
    description: note.description.trim() || null,
  }));
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ReleaseStatusBadges({
  release,
}: {
  release: ReleaseListItem;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {release.status === "DRAFT" ? (
        <Badge variant="secondary">Черновик</Badge>
      ) : (
        <Badge variant="outline">Опубликовано</Badge>
      )}
      {release.isCurrent ? (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">Текущая</Badge>
      ) : null}
    </div>
  );
}

export function ReleaseHistoryPanel({
  initialReleases,
}: ReleaseHistoryPanelProps) {
  const router = useRouter();
  const [releases, setReleases] = useState(initialReleases);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<ReleaseListItem | null>(
    null,
  );
  const [form, setForm] = useState<ReleaseFormState>(emptyFormState);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReleaseListItem | null>(
    null,
  );

  const isEditing = editingRelease != null;

  const refreshFromServer = useCallback(async () => {
    const response = await fetch("/api/admin/releases");
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Не удалось обновить список версий");
    }
    setReleases(data.releases);
    router.refresh();
  }, [router]);

  const openCreate = useCallback(() => {
    setEditingRelease(null);
    setForm(emptyFormState());
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((release: ReleaseListItem) => {
    setEditingRelease(release);
    setForm(releaseToFormState(release));
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setEditingRelease(null);
    setForm(emptyFormState());
  }, []);

  const updateFormField = useCallback(
    <K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addNote = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      notes: [createNoteDraft(), ...prev.notes],
    }));
  }, []);

  const updateNote = useCallback(
    (key: string, patch: Partial<NoteDraft>) => {
      setForm((prev) => ({
        ...prev,
        notes: prev.notes.map((note) =>
          note.key === key ? { ...note, ...patch } : note,
        ),
      }));
    },
    [],
  );

  const removeNote = useCallback((key: string) => {
    setForm((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.key !== key),
    }));
  }, []);

  const validateForm = useCallback((): string | null => {
    if (!form.version.trim()) return "Укажите номер версии";
    if (form.title.trim().length < 2) return "Название должно быть не короче 2 символов";
    for (const note of form.notes) {
      if (note.title.trim().length < 2) {
        return "Каждый пункт изменений должен иметь название не короче 2 символов";
      }
    }
    return null;
  }, [form]);

  const buildPayload = useCallback(() => {
    return {
      version: form.version.trim(),
      title: form.title.trim(),
      notes: notesToPayload(form.notes),
    };
  }, [form]);

  const saveDraft = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const response = await fetch(
        isEditing
          ? `/api/admin/releases/${editingRelease.id}`
          : "/api/admin/releases",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Не удалось сохранить черновик");
      }

      toast.success(isEditing ? "Версия обновлена" : "Черновик создан");
      closeSheet();
      await refreshFromServer();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить черновик",
      );
    } finally {
      setSaving(false);
    }
  }, [
    buildPayload,
    closeSheet,
    editingRelease,
    isEditing,
    refreshFromServer,
    validateForm,
  ]);

  const publishRelease = useCallback(
    async (release: ReleaseListItem) => {
      setSaving(true);
      try {
        const response = await fetch(
          `/api/admin/releases/${release.id}/publish`,
          { method: "POST" },
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "Не удалось опубликовать версию");
        }

        toast.success("Версия опубликована и отмечена как текущая");
        if (sheetOpen && editingRelease?.id === release.id) {
          closeSheet();
        }
        await refreshFromServer();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось опубликовать версию",
        );
      } finally {
        setSaving(false);
      }
    },
    [closeSheet, editingRelease?.id, refreshFromServer, sheetOpen],
  );

  const setCurrent = useCallback(
    async (release: ReleaseListItem) => {
      setSaving(true);
      try {
        const response = await fetch(
          `/api/admin/releases/${release.id}/current`,
          { method: "POST" },
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "Не удалось сделать версию текущей");
        }

        toast.success("Версия отмечена как текущая");
        await refreshFromServer();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Не удалось сделать версию текущей",
        );
      } finally {
        setSaving(false);
      }
    },
    [refreshFromServer],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/releases/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Не удалось удалить черновик");
      }

      toast.success("Черновик удалён");
      setDeleteTarget(null);
      if (editingRelease?.id === deleteTarget.id) {
        closeSheet();
      }
      await refreshFromServer();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить черновик",
      );
    } finally {
      setSaving(false);
    }
  }, [closeSheet, deleteTarget, editingRelease?.id, refreshFromServer]);

  const publishFromSheet = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      let releaseId = editingRelease?.id;

      if (!releaseId) {
        const createResponse = await fetch("/api/admin/releases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        const createData = await createResponse.json();
        if (!createResponse.ok || !createData.success) {
          throw new Error(createData.error ?? "Не удалось сохранить версию");
        }
        releaseId = createData.release.id as string;
      } else {
        const updateResponse = await fetch(`/api/admin/releases/${releaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        const updateData = await updateResponse.json();
        if (!updateResponse.ok || !updateData.success) {
          throw new Error(updateData.error ?? "Не удалось обновить версию");
        }
      }

      const publishResponse = await fetch(
        `/api/admin/releases/${releaseId}/publish`,
        { method: "POST" },
      );
      const publishData = await publishResponse.json();
      if (!publishResponse.ok || !publishData.success) {
        throw new Error(publishData.error ?? "Не удалось опубликовать версию");
      }

      toast.success("Версия опубликована и отмечена как текущая");
      closeSheet();
      await refreshFromServer();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось опубликовать версию",
      );
    } finally {
      setSaving(false);
    }
  }, [
    buildPayload,
    closeSheet,
    editingRelease?.id,
    refreshFromServer,
    validateForm,
  ]);

  const sortedReleases = useMemo(() => releases, [releases]);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">История версий</CardTitle>
              <CardDescription>
                Продуктовая история релизов и список изменений
              </CardDescription>
            </div>
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить версию
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Запись версии описывает изменения продукта и не создаёт техническую
            сборку. Реальная сборка определяется commit/build pipeline.
          </p>

          {sortedReleases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Пока нет записей о версиях. Добавьте первую версию, чтобы вести
                историю релизов.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedReleases.map((release) => (
                <div
                  key={release.id}
                  className="rounded-xl border border-border/80 bg-background p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          v{release.version}
                        </h3>
                        <ReleaseStatusBadges release={release} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {release.title}
                        </p>
                        {release.description ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {release.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Опубликовано: {formatDate(release.releasedAt)}</span>
                        <span>Создано: {formatDate(release.createdAt)}</span>
                      </div>
                      {release.notes.length > 0 ? (
                        <ul className="space-y-2 border-t border-border/60 pt-3">
                          {release.notes.map((note) => (
                            <li
                              key={note.id}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className={cn(
                                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                NOTE_TYPE_BADGE_CLASS[note.type],
                              )}>
                                {NOTE_TYPE_LABEL[note.type]}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                  {note.title}
                                </p>
                                {note.description ? (
                                  <p className="mt-0.5 text-muted-foreground">
                                    {note.description}
                                  </p>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(release)}
                        disabled={saving}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Редактировать
                      </Button>
                      {release.status === "DRAFT" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => publishRelease(release)}
                            disabled={saving}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Опубликовать
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(release)}
                            disabled={saving}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить
                          </Button>
                        </>
                      ) : null}
                      {release.status === "PUBLISHED" && !release.isCurrent ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setCurrent(release)}
                          disabled={saving}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          Сделать текущей
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
          <SheetHeader className="shrink-0">
            <SheetTitle>
              {isEditing ? "Редактировать версию" : "Новая версия"}
            </SheetTitle>
            <SheetDescription>
              Запись версии описывает изменения продукта и не создаёт
              техническую сборку. Реальная сборка определяется commit/build
              pipeline.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4 pb-2">
            <div className="space-y-2">
              <Label htmlFor="release-version">Version</Label>
              <Input
                id="release-version"
                value={form.version}
                onChange={(event) => {
                  const raw = event.target.value;
                  const isDeleting = raw.length < form.version.length;

                  if (isDeleting) {
                    // On delete: preserve structure, just clean up stray chars/dots
                    const cleaned = raw
                      .replace(/[^\d.]/g, "")
                      .replace(/\.{2,}/g, ".")
                      .replace(/^\.|\.$/g, "");
                    const parts = cleaned.split(".").slice(0, 3).map((s) => s.slice(0, 3));
                    updateFormField("version", parts.join("."));
                  } else {
                    // On add: extract digits only and auto-insert dots → X.X.XXX
                    const digits = raw.replace(/\D/g, "").slice(0, 5);
                    let masked = digits.slice(0, 1);
                    if (digits.length > 1) masked += "." + digits[1];
                    if (digits.length > 2) masked += "." + digits.slice(2);
                    updateFormField("version", masked);
                  }
                }}
                placeholder="1.2.0"
                inputMode="decimal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="release-title">Title</Label>
              <Input
                id="release-title"
                value={form.title}
                onChange={(event) =>
                  updateFormField("title", event.target.value)
                }
                placeholder="Майский релиз"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">Notes</Label>
                <Button type="button" variant="outline" size="sm" onClick={addNote}>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить пункт
                </Button>
              </div>

              {form.notes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                  Пока нет пунктов изменений.
                </p>
              ) : (
                <div className="space-y-4">
                  {form.notes.map((note) => (
                    <div
                      key={note.key}
                      className={cn(
                        "rounded-xl border border-border/80 bg-muted/10 p-4",
                      )}
                    >
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wide">
                            Пункт
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeNote(note.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={note.type}
                            onValueChange={(value) =>
                              updateNote(note.key, {
                                type: value as ReleaseNoteTypeValue,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NOTE_TYPE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  <span className={cn(
                                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                    NOTE_TYPE_BADGE_CLASS[option.value],
                                  )}>
                                    {option.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            value={note.title}
                            onChange={(event) =>
                              updateNote(note.key, {
                                title: event.target.value,
                              })
                            }
                            placeholder="Краткое название изменения"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={note.description}
                            onChange={(event) =>
                              updateNote(note.key, {
                                description: event.target.value,
                              })
                            }
                            placeholder="Необязательное описание"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="mt-0 shrink-0 gap-2 border-t bg-background px-4 pb-4 pt-4 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              disabled={saving}
              className="w-full"
            >
              Сохранить черновик
            </Button>
            <Button
              type="button"
              onClick={publishFromSheet}
              disabled={saving}
              className="w-full"
            >
              Опубликовать
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Версия v{deleteTarget?.version} будет удалена без возможности
              восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
