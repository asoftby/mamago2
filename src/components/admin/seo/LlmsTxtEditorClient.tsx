"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Bot, ExternalLink, FileText, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { useUnsavedChangesNavigationGuard } from "@/hooks/use-unsaved-changes-navigation-guard";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import { toast } from "@/lib/toast";
import type { SeoLlmsTxtSnapshot } from "@/lib/seo/llms";

type LlmsTxtEditorClientProps = {
  initialSnapshot: SeoLlmsTxtSnapshot;
  defaultContent: string;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "Ещё не обновлялся";

  try {
    return format(new Date(iso), "d MMMM yyyy, HH:mm", { locale: ru });
  } catch {
    return iso;
  }
}

export function LlmsTxtEditorClient({
  initialSnapshot,
  defaultContent,
}: LlmsTxtEditorClientProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialSnapshot.content);
  const [isEnabled, setIsEnabled] = useState(initialSnapshot.isEnabled);
  const [savedSnapshot, setSavedSnapshot] = useState(initialSnapshot);
  const [isSaving, setIsSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    setContent(initialSnapshot.content);
    setIsEnabled(initialSnapshot.isEnabled);
    setSavedSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const dirty =
    content !== savedSnapshot.content || isEnabled !== savedSnapshot.isEnabled;
  const charCount = content.length;
  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange } =
    useUnsavedChangesNavigationGuard(dirty);

  async function handleSave() {
    setIsSaving(true);

    try {
      const res = await fetch("/api/admin/seo/llms-txt", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          isEnabled,
        }),
      });

      const body: unknown = await res.json();

      if (!res.ok) {
        toast.error(messageFromApiError(body, res.status));
        return;
      }

      const item = (body as { item: SeoLlmsTxtSnapshot }).item;
      setSavedSnapshot(item);
      setContent(item.content);
      setIsEnabled(item.isEnabled);
      toast.success("llms.txt сохранён");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить llms.txt");
    } finally {
      setIsSaving(false);
    }
  }

  function handleResetToDefault() {
    setContent(defaultContent);
    setResetDialogOpen(false);
    toast.info("Шаблон подставлен. Не забудьте сохранить изменения.");
  }

  return (
    <div className="space-y-8 pb-8">
      <SeoPageHeader
        title="llms.txt"
        subtitle="Файл для AI Search Readiness — помогает AI-поисковикам и ассистентам понимать структуру mamaGo."
        leading={<Bot className="h-6 w-6 text-gray-700" aria-hidden />}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setResetDialogOpen(true)}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Сбросить к шаблону
            </Button>
            <Button type="button" variant="outline" className="gap-2" asChild>
              <Link
                href={savedSnapshot.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Открыть /llms.txt
              </Link>
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => void handleSave()}
              disabled={isSaving || !dirty}
            >
              <Save className="h-4 w-4" aria-hidden />
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_340px]">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Содержимое файла</CardTitle>
            <CardDescription>
              Текст доступен публично по адресу `/llms.txt` и должен помогать LLM-краулерам понять структуру сайта.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="llms-enabled" className="text-sm font-medium text-gray-900">
                  Включить llms.txt
                </Label>
                <p className="text-xs text-gray-500">
                  При выключении публичный `/llms.txt` будет отдавать 404.
                </p>
              </div>
              <Switch
                id="llms-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="llms-content" className="text-sm font-medium text-gray-900">
                  Content
                </Label>
                <span className="text-xs text-gray-500">{charCount.toLocaleString("ru-RU")} символов</span>
              </div>
              <Textarea
                id="llms-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                spellCheck={false}
                className="min-h-[500px] resize-y font-mono text-sm leading-6"
                placeholder="Введите содержимое llms.txt"
                disabled={isSaving}
              />
            </div>

            {dirty ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Есть несохранённые изменения.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Статус</CardTitle>
              <CardDescription>Текущее состояние публичного файла.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">URL</p>
                <p className="mt-1 break-all font-mono text-sm text-gray-900">
                  {savedSnapshot.publicUrl}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Статус</span>
                <Badge variant={isEnabled ? "default" : "secondary"}>
                  {isEnabled ? "Включен" : "Отключен"}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Источник</span>
                <Badge variant="outline">
                  {savedSnapshot.source === "database" ? "Пользовательский" : "Шаблон"}
                </Badge>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-gray-600">Последнее обновление</span>
                <span className="text-right text-sm font-medium text-gray-900">
                  {formatDateTime(savedSnapshot.updatedAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Городские версии llms.txt</CardTitle>
              <CardDescription>
                Позже здесь можно будет настроить отдельные инструкции для Минска, Гродно и других городов.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                Multi-city storefront support запланирован. Сейчас активен только глобальный `llms.txt`.
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Подсказка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <p>Указывайте ключевые разделы, типы контента и правила интерпретации фактов без маркетингового шума.</p>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <p>Для локальных ответов полезно явно приоритизировать `/minsk` и его дочерние разделы.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить к шаблону?</AlertDialogTitle>
            <AlertDialogDescription>
              Текущее содержимое в редакторе будет заменено дефолтным шаблоном mamaGo. Изменение не отправится в базу, пока вы не нажмёте «Сохранить».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Отмена</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={handleResetToDefault}>
              Подставить шаблон
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveDialogOpen} onOpenChange={onLeaveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              Изменения в `llms.txt` ещё не сохранены. Если уйти со страницы сейчас, они потеряются.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Остаться</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmLeave}>
              Уйти без сохранения
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
