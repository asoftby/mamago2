"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { applySeoTemplateString, previewValuesFromDocs } from "@/lib/admin/seo/applySeoTemplate";
import type { SeoTemplate, SeoTemplateScope } from "@/lib/admin/seo/seoTemplateTypes";
import {
  SEO_TEMPLATE_SCOPE_LABEL,
  SEO_TEMPLATE_SCOPE_ORDER,
  SEO_TEMPLATE_VARIABLE_DOCS,
} from "@/lib/admin/seo/seoTemplateTypes";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";

interface SeoTemplatesClientProps {
  initialTemplates: SeoTemplate[];
}

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function SeoTemplatesClient({ initialTemplates }: SeoTemplatesClientProps) {
  const [templates, setTemplates] = useState<SeoTemplate[]>(initialTemplates);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SeoTemplate | null>(null);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>(() =>
    previewValuesFromDocs({}),
  );

  const openEdit = useCallback((t: SeoTemplate) => {
    setDraft({ ...t });
    setPreviewVars(previewValuesFromDocs({}));
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setDraft(null);
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft) return;
    setTemplates((prev) =>
      prev.map((row) => (row.id === draft.id ? { ...draft } : row)),
    );
    closeSheet();
  }, [draft, closeSheet]);

  const grouped = useMemo(() => {
    const map = new Map<SeoTemplateScope, SeoTemplate[]>();
    for (const s of SEO_TEMPLATE_SCOPE_ORDER) {
      map.set(s, []);
    }
    for (const t of templates) {
      const list = map.get(t.scope);
      if (list) list.push(t);
    }
    return map;
  }, [templates]);

  const previewGenerated = useMemo(() => {
    if (!draft) return null;
    const v = previewValuesFromDocs(previewVars);
    return {
      title: applySeoTemplateString(draft.titleTemplate, v),
      h1: applySeoTemplateString(draft.h1Template, v),
      description: applySeoTemplateString(draft.descriptionTemplate, v),
    };
  }, [draft, previewVars]);

  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="SEO Templates"
        subtitle="Шаблоны title, H1 и description для SEO pages и сущностей"
      />

      <p className="max-w-3xl text-sm text-gray-600">
        Управляйте метаданными системно: один шаблон на тип страницы или сущности.
        Переменные в фигурных скобках подставляются из контекста (город, дата, сущность).
      </p>

      <div className="space-y-10">
        {SEO_TEMPLATE_SCOPE_ORDER.map((scope) => {
          const items = grouped.get(scope) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={scope} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-base font-semibold text-gray-900">
                  {SEO_TEMPLATE_SCOPE_LABEL[scope]}
                </h3>
                <span className="text-xs text-gray-500">
                  {items.length}{" "}
                  {items.length === 1 ? "шаблон" : "шаблонов"}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((tpl) => (
                  <Card
                    key={tpl.id}
                    className={cn(
                      "gap-0 py-0 transition-shadow hover:shadow-md",
                      !tpl.active && "opacity-80",
                    )}
                  >
                    <CardHeader className="gap-2 border-b border-border/60 pb-4 pt-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="text-base leading-snug">
                            {tpl.name}
                          </CardTitle>
                          <CardDescription className="text-xs leading-relaxed">
                            {tpl.appliesToLabel}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={tpl.active ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {tpl.active ? "Активен" : "Выкл"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4 pb-5">
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="font-medium text-gray-600">Title</span>
                          <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-gray-800">
                            {truncate(tpl.titleTemplate, 120)}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">H1</span>
                          <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-gray-800">
                            {truncate(tpl.h1Template, 120)}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">
                            Description
                          </span>
                          <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-gray-800">
                            {truncate(tpl.descriptionTemplate, 140)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => openEdit(tpl)}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Редактировать шаблон
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent
          side="right"
          showCloseButton
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          {draft ? (
            <>
              <SheetHeader className="border-b border-border px-6 py-4 text-left">
                <SheetTitle>Редактирование шаблона</SheetTitle>
                <SheetDescription>
                  Изменения сохраняются только в сессии (мок). Подключение API —
                  отдельным шагом.
                </SheetDescription>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="tpl-name">Название шаблона</Label>
                    <Input
                      id="tpl-name"
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, name: e.target.value } : d))
                      }
                      placeholder="Например: City preset — default"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tpl-applies">Applies to (тип)</Label>
                    <Select
                      value={draft.scope}
                      onValueChange={(v: SeoTemplateScope) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                scope: v,
                                appliesToLabel: d.appliesToLabel,
                              }
                            : d,
                        )
                      }
                    >
                      <SelectTrigger id="tpl-applies" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEO_TEMPLATE_SCOPE_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SEO_TEMPLATE_SCOPE_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Определяет, к каким страницам или сущностям применяется шаблон.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tpl-applies-label">Подпись «применяется к»</Label>
                    <Input
                      id="tpl-applies-label"
                      value={draft.appliesToLabel}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, appliesToLabel: e.target.value } : d,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tpl-title">Title template</Label>
                    <Textarea
                      id="tpl-title"
                      rows={2}
                      className="font-mono text-sm"
                      value={draft.titleTemplate}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, titleTemplate: e.target.value } : d,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpl-h1">H1 template</Label>
                    <Textarea
                      id="tpl-h1"
                      rows={2}
                      className="font-mono text-sm"
                      value={draft.h1Template}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, h1Template: e.target.value } : d,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpl-desc">Description template</Label>
                    <Textarea
                      id="tpl-desc"
                      rows={3}
                      className="font-mono text-sm"
                      value={draft.descriptionTemplate}
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? { ...d, descriptionTemplate: e.target.value }
                            : d,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="tpl-active" className="text-sm font-medium">
                        Шаблон активен
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Неактивные шаблоны не участвуют в генерации метаданных.
                      </p>
                    </div>
                    <Switch
                      id="tpl-active"
                      checked={draft.active}
                      onCheckedChange={(checked) =>
                        setDraft((d) => (d ? { ...d, active: checked } : d))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/50 p-4 dark:bg-amber-950/20">
                    <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                      Поддерживаемые переменные
                    </p>
                    <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/90">
                      Вставляйте в шаблон в фигурных скобках. Регистр имени важен.
                    </p>
                    <ul className="mt-3 space-y-2 text-xs">
                      {SEO_TEMPLATE_VARIABLE_DOCS.map((doc) => (
                        <li
                          key={doc.key}
                          className="flex flex-col gap-0.5 rounded-md bg-white/60 px-2 py-1.5 dark:bg-black/20"
                        >
                          <code className="font-mono text-[11px] font-semibold text-amber-950 dark:text-amber-100">
                            {"{"}
                            {doc.key}
                            {"}"}
                          </code>
                          <span className="text-muted-foreground">
                            {doc.description}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Пример значения:{" "}
                            <span className="font-mono">{doc.example}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Контекст для превью</p>
                    <p className="text-xs text-muted-foreground">
                      Подставьте тестовые значения — так видно итог без публикации.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {SEO_TEMPLATE_VARIABLE_DOCS.map((doc) => (
                        <div key={doc.key} className="space-y-1">
                          <Label
                            htmlFor={`pv-${doc.key}`}
                            className="text-xs font-normal"
                          >
                            <code className="font-mono">
                              {"{"}
                              {doc.key}
                              {"}"}
                            </code>
                          </Label>
                          <Input
                            id={`pv-${doc.key}`}
                            value={previewVars[doc.key] ?? ""}
                            onChange={(e) =>
                              setPreviewVars((prev) => ({
                                ...prev,
                                [doc.key]: e.target.value,
                              }))
                            }
                            placeholder={doc.example}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {previewGenerated ? (
                    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                      <p className="text-sm font-semibold">Превью</p>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Generated title
                          </span>
                          <p className="mt-1 rounded border bg-muted/40 px-3 py-2 text-foreground">
                            {previewGenerated.title}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Generated H1
                          </span>
                          <p className="mt-1 rounded border bg-muted/40 px-3 py-2 text-foreground">
                            {previewGenerated.h1}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Generated description
                          </span>
                          <p className="mt-1 rounded border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground">
                            {previewGenerated.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <SheetFooter className="border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeSheet}>
                  Отмена
                </Button>
                <Button type="button" onClick={saveDraft}>
                  Сохранить
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
