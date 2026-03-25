"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { aggregateOverviewMetrics } from "@/lib/admin/seo/structuredDataAggregate";
import type {
  SchemaOverviewCard,
  SchemaTemplate,
  SchemaTemplateStatus,
  SchemaTemplateType,
  SchemaValidationIssue,
  ValidationIssueCategory,
} from "@/lib/admin/seo/domain/types";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  XCircle,
} from "lucide-react";

const TEMPLATE_STATUS: Record<
  SchemaTemplateStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ok: { label: "OK", variant: "default" },
  degraded: { label: "Деградация", variant: "secondary" },
  disabled: { label: "Отключено", variant: "outline" },
};

const VALIDATION_CATEGORY_ORDER: ValidationIssueCategory[] = [
  "missing_required",
  "disabled_incomplete",
  "no_structured_data",
  "warning",
];

const VALIDATION_CATEGORY_TITLE: Record<ValidationIssueCategory, string> = {
  missing_required: "Отсутствуют обязательные поля",
  disabled_incomplete: "Схема отключена из‑за неполных данных",
  no_structured_data: "Страницы без structured data",
  warning: "Предупреждения",
};

const SEVERITY_BADGE: Record<
  SchemaValidationIssue["severity"],
  { label: string; className: string }
> = {
  error: {
    label: "Ошибка",
    className: "border-red-200 bg-red-50 text-red-900",
  },
  warning: {
    label: "Внимание",
    className: "border-amber-200 bg-amber-50 text-amber-950",
  },
  info: {
    label: "Инфо",
    className: "border-slate-200 bg-slate-50 text-slate-800",
  },
};

function formatJsonPreview(value: Record<string, unknown>) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

interface StructuredDataCenterClientProps {
  initialOverviewCards: SchemaOverviewCard[];
  initialTemplates: SchemaTemplate[];
  initialValidation: SchemaValidationIssue[];
}

export function StructuredDataCenterClient({
  initialOverviewCards,
  initialTemplates,
  initialValidation,
}: StructuredDataCenterClientProps) {
  const [templates, setTemplates] = useState<SchemaTemplate[]>(initialTemplates);
  const [validationIssues] = useState(initialValidation);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SchemaTemplate | null>(null);

  const templatesById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );

  const overviewRows = useMemo(
    () =>
      initialOverviewCards.map((card) => ({
        card,
        metrics: aggregateOverviewMetrics(card, templatesById),
      })),
    [initialOverviewCards, templatesById],
  );

  const validationByCategory = useMemo(() => {
    const map = new Map<ValidationIssueCategory, SchemaValidationIssue[]>();
    for (const c of VALIDATION_CATEGORY_ORDER) {
      map.set(c, []);
    }
    for (const issue of validationIssues) {
      const list = map.get(issue.category) ?? [];
      list.push(issue);
      map.set(issue.category, list);
    }
    return map;
  }, [validationIssues]);

  const openEdit = useCallback((t: SchemaTemplate) => {
    setDraft({ ...t });
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

  const schemaTypeLabel = useCallback((t: SchemaTemplateType) => {
    if (t === "Place") return "Place / LocalBusiness";
    if (t === "CollectionPage") return "CollectionPage / ItemList";
    return t;
  }, []);

  return (
    <div className="space-y-6">
      <SeoPageHeader
        title="Structured Data"
        subtitle="Управление schema.org шаблонами и покрытием structured data"
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 p-1 sm:grid-cols-3">
          <TabsTrigger value="overview" className="justify-center py-2.5">
            Overview
          </TabsTrigger>
          <TabsTrigger value="templates" className="justify-center py-2.5">
            Templates
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({templates.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="validation" className="justify-center py-2.5">
            Validation
            {validationIssues.length > 0 ? (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {validationIssues.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <p className="text-sm text-gray-600">
            Сводка по типам разметки: активность шаблонов, охват страниц и
            предупреждения. Цифры обновляются при изменении шаблонов.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overviewRows.map(({ card, metrics }) => (
              <Card
                key={card.id}
                className={cn(
                  "gap-0 py-0 shadow-sm transition-shadow hover:shadow-md",
                  !metrics.active && "opacity-90",
                )}
              >
                <CardHeader className="border-b border-border/60 pb-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {card.title}
                    </CardTitle>
                    <Badge variant={metrics.active ? "default" : "secondary"}>
                      {metrics.active ? "Активно" : "Выкл"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Покрытие и предупреждения по связанным шаблонам
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 pt-4 pb-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Coverage
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">
                      {metrics.coverageCount.toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Warnings
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-lg font-semibold tabular-nums",
                        metrics.warningsCount > 0
                          ? "text-amber-700"
                          : "text-emerald-700",
                      )}
                    >
                      {metrics.warningsCount.toLocaleString("ru-RU")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-6 space-y-4">
          <p className="text-sm text-gray-600">
            Шаблоны JSON-LD задают маппинг полей из данных сайта. Редактирование —
            через карту полей и превью; сырой JSON не является основным сценарием.
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50/90">
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Schema type
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Applies to
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Active
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {schemaTypeLabel(row.schemaType)}
                        </span>
                      </td>
                      <td className="max-w-[240px] px-4 py-3 text-gray-700">
                        {row.appliesTo}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={TEMPLATE_STATUS[row.status].variant}>
                          {TEMPLATE_STATUS[row.status].label}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {row.active ? (
                          <span className="text-emerald-700">yes</span>
                        ) : (
                          <span className="text-gray-500">no</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="validation" className="mt-6 space-y-6">
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Очередь проверок: обязательные поля, отключённые схемы, страницы без
                разметки и предупреждения Rich Results. Подключение к краулеру —
                отдельным этапом.
              </p>
            </div>
          </div>

          {VALIDATION_CATEGORY_ORDER.map((cat) => {
            const items = validationByCategory.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat} className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {VALIDATION_CATEGORY_TITLE[cat]}
                </h3>
                <ul className="space-y-2">
                  {items.map((issue) => (
                    <li
                      key={issue.id}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-gray-900">
                            {issue.title}
                          </p>
                          <p className="text-sm text-gray-600">{issue.detail}</p>
                          {issue.pageUrl ? (
                            <p className="font-mono text-xs text-muted-foreground">
                              {issue.pageUrl}
                            </p>
                          ) : null}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 border",
                            SEVERITY_BADGE[issue.severity].className,
                          )}
                        >
                          {SEVERITY_BADGE[issue.severity].label}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          {draft ? (
            <>
              <SheetHeader className="border-b border-border px-6 py-4 text-left">
                <SheetTitle>Schema template</SheetTitle>
                <SheetDescription>
                  Тип <code className="font-mono text-xs">{draft.schemaType}</code>
                  . Управление через шаблон и маппинг полей; сырой JSON-LD — только
                  превью.
                </SheetDescription>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Тип схемы</p>
                      <p className="text-sm text-muted-foreground">
                        {schemaTypeLabel(draft.schemaType)}
                      </p>
                    </div>
                    <Badge variant={TEMPLATE_STATUS[draft.status].variant}>
                      {TEMPLATE_STATUS[draft.status].label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="schema-active" className="text-sm font-medium">
                        Шаблон активен
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Выкл — JSON-LD для этого типа не отдаётся.
                      </p>
                    </div>
                    <Switch
                      id="schema-active"
                      checked={draft.active}
                      onCheckedChange={(c) => {
                        setDraft((d) => {
                          if (!d) return d;
                          if (!c) {
                            return { ...d, active: false, status: "disabled" };
                          }
                          const allReq = d.requiredFields.every((x) => x.satisfied);
                          return {
                            ...d,
                            active: true,
                            status: allReq ? "ok" : "degraded",
                          };
                        });
                      }}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium">Applies to</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {draft.appliesTo}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Field mapping</p>
                    <p className="text-xs text-muted-foreground">
                      Сводка привязки полей schema.org к данным приложения.
                    </p>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 font-medium">Schema field</th>
                            <th className="px-3 py-2 font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {draft.fieldMappings.map((m) => (
                            <tr key={`${m.schemaField}-${m.source}`}>
                              <td className="px-3 py-2 font-mono text-[11px]">
                                {m.schemaField}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                                {m.source}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Required fields</p>
                    <ul className="space-y-1.5">
                      {draft.requiredFields.map((f) => (
                        <li
                          key={f.key}
                          className="flex items-center gap-2 text-sm"
                        >
                          {f.satisfied ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <code className="font-mono text-xs">{f.key}</code>
                          <span className="text-xs text-muted-foreground">
                            {f.satisfied ? "заполнено" : "не хватает данных"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Sample output preview</p>
                    <p className="text-xs text-muted-foreground">
                      Пример сгенерированного фрагмента JSON-LD (только просмотр).
                    </p>
                    <div className="max-h-[280px] overflow-auto rounded-lg border bg-slate-950/5 p-3 dark:bg-slate-950/40">
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-800 dark:text-slate-100">
                        {formatJsonPreview(draft.sampleJsonLd)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter className="border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeSheet}>
                  Закрыть
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
