"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Grip, Loader2, Plus, Rocket, Save, Send, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmailTemplatePreviewPanel } from "@/components/admin/email-studio/EmailTemplatePreviewPanel";
import { EmailTemplateStatusBadge } from "@/components/admin/email-studio/EmailTemplateStatusBadge";
import { EmailTemplateVersionHistoryCard } from "@/components/admin/email-studio/EmailTemplateVersionHistoryCard";
import { SendTestEmailDialog } from "@/components/admin/email-studio/SendTestEmailDialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createDefaultEmailBlock,
  type EmailBlock,
  type EmailBlockType,
  type EmailTemplateDocument,
  type EmailTemplateStatus,
  type EmailTemplateType,
} from "@/features/email-studio/lib";
import { useUnsavedChangesNavigationGuard } from "@/hooks/use-unsaved-changes-navigation-guard";

type EmailTemplateEditorRecord = {
  id: string;
  name: string;
  type: EmailTemplateType;
  subject: string;
  preheader: string | null;
  fromName: string | null;
  status: EmailTemplateStatus;
  version: number;
  document: EmailTemplateDocument;
  createdAt: string;
  updatedAt: string;
};

type EditorState = {
  name: string;
  type: EmailTemplateType;
  subject: string;
  preheader: string;
  fromName: string;
  status: EmailTemplateStatus;
  version: number;
  updatedAt: string;
  document: EmailTemplateDocument;
};

const TEMPLATE_TYPE_OPTIONS: EmailTemplateType[] = [
  "WELCOME",
  "VERIFY_EMAIL",
  "RESET_PASSWORD",
  "PLAN_REMINDER",
  "WEEKLY_DIGEST",
  "PROMO_CAMPAIGN",
  "CUSTOM",
];

const BLOCK_TYPE_OPTIONS: EmailBlockType[] = [
  "header",
  "hero",
  "text",
  "cta",
  "spacer",
  "divider",
  "footer",
];

type PreviewPreset = "new-user" | "user-with-child" | "plan-reminder" | "empty-state";

function typeLabel(type: EmailTemplateType): string {
  switch (type) {
    case "WELCOME":
      return "Приветственное письмо";
    case "VERIFY_EMAIL":
      return "Подтверждение email";
    case "RESET_PASSWORD":
      return "Сброс пароля";
    case "PLAN_REMINDER":
      return "Напоминание о плане";
    case "WEEKLY_DIGEST":
      return "Еженедельный дайджест";
    case "PROMO_CAMPAIGN":
      return "Промо-кампания";
    case "CUSTOM":
      return "Кастомный шаблон";
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

function blockTypeLabel(type: EmailBlockType): string {
  switch (type) {
    case "header":
      return "Шапка";
    case "hero":
      return "Hero";
    case "text":
      return "Текст";
    case "cta":
      return "CTA";
    case "spacer":
      return "Отступ";
    case "divider":
      return "Разделитель";
    case "footer":
      return "Футер";
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-BY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function templateToEditorState(template: EmailTemplateEditorRecord): EditorState {
  return {
    name: template.name,
    type: template.type,
    subject: template.subject,
    preheader: template.preheader ?? "",
    fromName: template.fromName ?? "",
    status: template.status,
    version: template.version,
    updatedAt: template.updatedAt,
    document: template.document,
  };
}

function clearTransientEditorMessages(
  setSaveError: Dispatch<SetStateAction<string | null>>,
  setSaveMessage: Dispatch<SetStateAction<string | null>>,
) {
  setSaveError(null);
  setSaveMessage(null);
}
function editorComparable(state: EditorState | null): string {
  if (!state) return "";
  return JSON.stringify({
    name: state.name,
    type: state.type,
    subject: state.subject,
    preheader: state.preheader,
    fromName: state.fromName,
    document: state.document,
  });
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message || data.error || "Request failed";
  } catch {
    return "Request failed";
  }
}

function replaceBlock(
  blocks: EmailBlock[],
  blockId: string,
  updater: (block: EmailBlock) => EmailBlock,
): EmailBlock[] {
  return blocks.map((block) => (block.id === blockId ? updater(block) : block));
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function BlockInsertRow({
  index,
  isActive,
  blockType,
  onActivate,
  onInsert,
  onCancel,
  onBlockTypeChange,
}: {
  index: number;
  isActive: boolean;
  blockType: EmailBlockType;
  onActivate: () => void;
  onInsert: () => void;
  onCancel: () => void;
  onBlockTypeChange: (type: EmailBlockType) => void;
}) {
  if (!isActive) {
    return (
      <div className="group relative flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onActivate}
          className="h-7 gap-1.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Plus className="size-3.5" />
          Добавить блок
        </Button>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="flex-1 space-y-1.5">
        <Label className="text-xs">Тип блока</Label>
        <Select value={blockType} onValueChange={(value: EmailBlockType) => onBlockTypeChange(value)}>
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {blockTypeLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" onClick={onInsert} className="h-8">
        Добавить
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} className="h-8">
        Отмена
      </Button>
    </div>
  );
}

function BlockCard({
  block,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  onChange,
}: {
  block: EmailBlock;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onChange: (next: EmailBlock) => void;
}) {
  return (
    <Card className="gap-4">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-border bg-muted/40 p-2 text-muted-foreground">
              <Grip className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">{blockTypeLabel(block.type)}</CardTitle>
              <CardDescription>
                Блок #{index + 1}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={onMoveUp} disabled={index === 0}>
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onMoveDown}
              disabled={index === total - 1}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={onRemove}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {block.type === "header" ? (
          <>
            <div className="space-y-2">
              <Label>Текст бренда</Label>
              <Input
                value={block.brandText}
                onChange={(e) => onChange({ ...block, brandText: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ссылка бренда</Label>
              <Input
                value={block.brandHref}
                onChange={(e) => onChange({ ...block, brandHref: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL логотипа</Label>
              <Input
                value={block.logoUrl ?? ""}
                onChange={(e) => onChange({ ...block, logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </>
        ) : null}

        {block.type === "hero" ? (
          <>
            <div className="space-y-2">
              <Label>Заголовок</Label>
              <Textarea
                rows={2}
                value={block.title}
                onChange={(e) => onChange({ ...block, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Текст</Label>
              <Textarea
                rows={4}
                value={block.text}
                onChange={(e) => onChange({ ...block, text: e.target.value })}
                placeholder="Поддерживается форматирование:&#10;**жирный текст**&#10;Переносы строк сохраняются"
              />
              <p className="text-xs text-muted-foreground">
                Форматирование: **жирный**, переносы строк
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Текст кнопки</Label>
                <Input
                  value={block.buttonLabel}
                  onChange={(e) => onChange({ ...block, buttonLabel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>URL кнопки</Label>
                <Input
                  value={block.buttonUrl}
                  onChange={(e) => onChange({ ...block, buttonUrl: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>URL изображения</Label>
                <Input
                  value={block.imageUrl ?? ""}
                  onChange={(e) => onChange({ ...block, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Выравнивание</Label>
                <Select
                  value={block.align}
                  onValueChange={(value: "left" | "center") => onChange({ ...block, align: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Слева</SelectItem>
                    <SelectItem value="center">По центру</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : null}

        {block.type === "text" ? (
          <div className="space-y-2">
            <Label>Содержимое</Label>
            <Textarea
              rows={6}
              value={block.content}
              onChange={(e) => onChange({ ...block, content: e.target.value })}
              placeholder="Поддерживается форматирование:&#10;**жирный текст**&#10;Переносы строк сохраняются"
            />
            <p className="text-xs text-muted-foreground">
              Форматирование: **жирный**, переносы строк
            </p>
          </div>
        ) : null}

        {block.type === "cta" ? (
          <>
            <div className="space-y-2">
              <Label>Заголовок</Label>
              <Input
                value={block.title}
                onChange={(e) => onChange({ ...block, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Текст</Label>
              <Textarea
                rows={4}
                value={block.text}
                onChange={(e) => onChange({ ...block, text: e.target.value })}
                placeholder="Поддерживается форматирование:&#10;**жирный текст** или __жирный текст__&#10;Переносы строк сохраняются"
              />
              <p className="text-xs text-muted-foreground">
                Форматирование: **жирный** или __жирный__, переносы строк
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Текст кнопки</Label>
                <Input
                  value={block.buttonLabel}
                  onChange={(e) => onChange({ ...block, buttonLabel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>URL кнопки</Label>
                <Input
                  value={block.buttonUrl}
                  onChange={(e) => onChange({ ...block, buttonUrl: e.target.value })}
                />
              </div>
            </div>
          </>
        ) : null}

        {block.type === "spacer" ? (
          <div className="space-y-2">
            <Label>Размер</Label>
            <Select
              value={block.size}
              onValueChange={(value: "xs" | "sm" | "md" | "lg" | "xl") =>
                onChange({ ...block, size: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xs">XS</SelectItem>
                <SelectItem value="sm">SM</SelectItem>
                <SelectItem value="md">MD</SelectItem>
                <SelectItem value="lg">LG</SelectItem>
                <SelectItem value="xl">XL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {block.type === "divider" ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            У блока-разделителя в MVP нет редактируемых полей.
          </div>
        ) : null}

        {block.type === "footer" ? (
          <>
            <div className="space-y-2">
              <Label>Email поддержки</Label>
              <Input
                value={block.supportEmail ?? ""}
                onChange={(e) => onChange({ ...block, supportEmail: e.target.value })}
                placeholder="support@mamago.by"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <div className="text-sm font-medium">Показывать ссылку отписки</div>
                <div className="text-xs text-muted-foreground">
                  Renderer подставит общую ссылку отписки через shared token.
                </div>
              </div>
              <Switch
                checked={block.showUnsubscribe}
                onCheckedChange={(checked) => onChange({ ...block, showUnsubscribe: checked })}
              />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function EmailTemplateEditorClient({ templateId }: { templateId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishWarning, setPublishWarning] = useState<string | null>(null);
  const [previewPreset, setPreviewPreset] = useState<PreviewPreset>("new-user");
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [newBlockType, setNewBlockType] = useState<EmailBlockType>("text");
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const savedComparableRef = useRef("");

  const loadTemplate = useCallback(async () => {
    setState("loading");
    setLoadError(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { template: EmailTemplateEditorRecord };
      const nextEditor = templateToEditorState(data.template);
      setEditor(nextEditor);
      savedComparableRef.current = editorComparable(nextEditor);
      setState("ready");
    } catch (error) {
      setState("error");
      setLoadError(error instanceof Error ? error.message : "Не удалось загрузить шаблон.");
    }
  }, [templateId]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  const dirty = editor ? editorComparable(editor) !== savedComparableRef.current : false;
  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange } =
    useUnsavedChangesNavigationGuard(dirty);

  function patchEditor(patch: Partial<EditorState>) {
    clearTransientEditorMessages(setSaveError, setSaveMessage);
    setEditor((current) => (current ? { ...current, ...patch } : current));
  }

  function patchDocument(updater: (document: EmailTemplateDocument) => EmailTemplateDocument) {
    clearTransientEditorMessages(setSaveError, setSaveMessage);
    setEditor((current) =>
      current
        ? {
            ...current,
            document: updater(current.document),
          }
        : current,
    );
  }

  async function handleSave() {
    if (!editor) return;

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editor.name,
          type: editor.type,
          subject: editor.subject,
          preheader: editor.preheader || null,
          fromName: editor.fromName || null,
          document: editor.document,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { template: EmailTemplateEditorRecord };
      const nextEditor = templateToEditorState(data.template);
      setEditor(nextEditor);
      savedComparableRef.current = editorComparable(nextEditor);
      setSaveMessage("Изменения сохранены.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить шаблон.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!editor) return;

    setPublishing(true);
    setPublishError(null);
    setPublishMessage(null);
    setPublishWarning(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as {
        template: EmailTemplateEditorRecord;
        publishedVersion: number;
        warning?: { code: string; message: string };
      };

      const nextEditor = templateToEditorState(data.template);
      setEditor(nextEditor);
      savedComparableRef.current = editorComparable(nextEditor);
      setPublishMessage(`Опубликовано как версия ${data.publishedVersion}.`);
      if (data.warning) {
        setPublishWarning(data.warning.message);
      }
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Не удалось опубликовать шаблон.");
    } finally {
      setPublishing(false);
    }
  }

  function handleBlockChange(blockId: string, nextBlock: EmailBlock) {
    patchDocument((document) => ({
      ...document,
      blocks: replaceBlock(document.blocks, blockId, () => nextBlock),
    }));
  }

  function handleBlockRemove(blockId: string) {
    patchDocument((document) => ({
      ...document,
      blocks: document.blocks.filter((block) => block.id !== blockId),
    }));
  }

  function handleBlockMove(blockId: string, direction: "up" | "down") {
    patchDocument((document) => {
      const index = document.blocks.findIndex((block) => block.id === blockId);
      if (index < 0) return document;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= document.blocks.length) return document;

      return {
        ...document,
        blocks: moveItem(document.blocks, index, nextIndex),
      };
    });
  }

  function handleInsertBlock(index: number) {
    patchDocument((document) => {
      const newBlock = createDefaultEmailBlock(newBlockType);
      const blocks = [...document.blocks];
      blocks.splice(index, 0, newBlock);
      return {
        ...document,
        blocks,
      };
    });
    setInsertAtIndex(null);
    setNewBlockType("text");
  }

  function handleCancelInsert() {
    setInsertAtIndex(null);
    setNewBlockType("text");
  }

  if (state === "loading") {
    return (
      <div className="space-y-6 p-6 md:p-4">
        <AdminPageHeader
          title="Email Studio"
          subtitle="Загружаем редактор…"
          backHref="/admin/email-studio"
        />
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-4 pt-6">
                {Array.from({ length: 6 }).map((__, itemIndex) => (
                  <div key={itemIndex} className="h-10 animate-pulse rounded-lg bg-muted/40" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state === "error" || !editor) {
    return (
      <div className="space-y-6 p-6 md:p-4">
        <AdminPageHeader
          title="Email Studio"
          subtitle="Не удалось открыть редактор."
          backHref="/admin/email-studio"
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loadError || "Unknown error"}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => void loadTemplate()}>
                Повторить
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/email-studio">Назад к шаблонам</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-6 md:p-4">
        <AdminPageHeader
          title={editor.name || "Новый шаблон"}
          subtitle={`Обновлён ${formatDate(editor.updatedAt)}`}
          backHref="/admin/email-studio"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSendTestOpen(true)}
              >
                <Send className="size-4" />
                Тестовая отправка
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handlePublish()}
                disabled={publishing || dirty || editor.status === "ARCHIVED"}
              >
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                Опубликовать
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving || !dirty}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Сохранить
              </Button>
            </>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Настройки</CardTitle>
                <CardDescription>
                  Основные параметры шаблона. Публикация остаётся отдельным действием.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {saveError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {saveError}
                  </div>
                ) : null}
                {saveMessage ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {saveMessage}
                  </div>
                ) : null}
                {publishError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {publishError}
                  </div>
                ) : null}
                {publishMessage ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {publishMessage}
                  </div>
                ) : null}
                {publishWarning ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    ⚠️ {publishWarning}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="template-name">Название шаблона</Label>
                  <Input
                    id="template-name"
                    value={editor.name}
                    onChange={(e) => patchEditor({ name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Тип шаблона</Label>
                  <Select
                    value={editor.type}
                    onValueChange={(value: EmailTemplateType) => patchEditor({ type: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {typeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-subject">Тема письма</Label>
                  <Input
                    id="template-subject"
                    value={editor.subject}
                    onChange={(e) => patchEditor({ subject: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-preheader">Прехедер</Label>
                  <Textarea
                    id="template-preheader"
                    rows={3}
                    value={editor.preheader}
                    onChange={(e) => patchEditor({ preheader: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-from-name">Имя отправителя</Label>
                  <Input
                    id="template-from-name"
                    value={editor.fromName}
                    onChange={(e) => patchEditor({ fromName: e.target.value })}
                    placeholder="mamaGo"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Статус</div>
                    <div className="text-xs text-muted-foreground">
                      Только для просмотра в редакторе
                    </div>
                  </div>
                  <EmailTemplateStatusBadge status={editor.status} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Опубликованная версия</div>
                    <div className="text-xs text-muted-foreground">
                      Номер последнего опубликованного snapshot
                    </div>
                  </div>
                  <div className="text-sm font-medium">v{editor.version}</div>
                </div>
              </CardContent>
            </Card>

            <EmailTemplateVersionHistoryCard
              templateId={templateId}
              currentVersion={editor.version}
            />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Блоки</CardTitle>
                <CardDescription>
                  Добавляйте, редактируйте и переставляйте блоки. Drag-and-drop пока не нужен.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editor.document.blocks.length === 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                      В шаблоне пока нет блоков. Добавьте первый блок, чтобы собрать письмо.
                    </div>
                    <BlockInsertRow
                      index={0}
                      isActive={insertAtIndex === 0}
                      blockType={newBlockType}
                      onActivate={() => setInsertAtIndex(0)}
                      onInsert={() => handleInsertBlock(0)}
                      onCancel={handleCancelInsert}
                      onBlockTypeChange={setNewBlockType}
                    />
                  </div>
                ) : (
                  <div className="space-y-0">
                    {editor.document.blocks.map((block, index) => (
                      <div key={block.id}>
                        <BlockInsertRow
                          index={index}
                          isActive={insertAtIndex === index}
                          blockType={newBlockType}
                          onActivate={() => setInsertAtIndex(index)}
                          onInsert={() => handleInsertBlock(index)}
                          onCancel={handleCancelInsert}
                          onBlockTypeChange={setNewBlockType}
                        />
                        <div className="pb-4">
                          <BlockCard
                            block={block}
                            index={index}
                            total={editor.document.blocks.length}
                            onMoveUp={() => handleBlockMove(block.id, "up")}
                            onMoveDown={() => handleBlockMove(block.id, "down")}
                            onRemove={() => handleBlockRemove(block.id)}
                            onChange={(nextBlock) => handleBlockChange(block.id, nextBlock)}
                          />
                        </div>
                      </div>
                    ))}
                    <BlockInsertRow
                      index={editor.document.blocks.length}
                      isActive={insertAtIndex === editor.document.blocks.length}
                      blockType={newBlockType}
                      onActivate={() => setInsertAtIndex(editor.document.blocks.length)}
                      onInsert={() => handleInsertBlock(editor.document.blocks.length)}
                      onCancel={handleCancelInsert}
                      onBlockTypeChange={setNewBlockType}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <EmailTemplatePreviewPanel
              subject={editor.subject}
              preheader={editor.preheader}
              document={editor.document}
              previewPreset={previewPreset}
              onPreviewPresetChange={setPreviewPreset}
            />
          </div>
        </div>
      </div>

      <AlertDialog open={leaveDialogOpen} onOpenChange={onLeaveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              Если уйти со страницы сейчас, изменения в шаблоне будут потеряны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave}>Уйти без сохранения</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendTestEmailDialog
        open={sendTestOpen}
        onOpenChange={setSendTestOpen}
        templateId={templateId}
        previewPreset={previewPreset}
        onPreviewPresetChange={setPreviewPreset}
      />
    </>
  );
}
