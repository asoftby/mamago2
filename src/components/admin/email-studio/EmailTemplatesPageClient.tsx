"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, Plus, RefreshCw, Rocket, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmailTemplateStatusBadge } from "@/components/admin/email-studio/EmailTemplateStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmailTemplateStatus, EmailTemplateType } from "@/features/email-studio/lib";
import {
  getEmailTemplateClassification,
  getEmailTemplateClassificationLabel,
  getEmailTemplateStatusDescription,
  getEmailTemplateTypeRuLabel,
} from "@/features/email-studio/lib/presentation";

type EmailTemplateListRow = {
  id: string;
  name: string;
  type: EmailTemplateType;
  subject: string;
  preheader: string | null;
  fromName: string | null;
  status: EmailTemplateStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type TemplatesResponse = {
  templates: EmailTemplateListRow[];
};

type MutationState = {
  kind: "create" | "duplicate" | "publish" | "delete" | null;
  templateId: string | null;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-BY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message || data.error || "Request failed";
  } catch {
    return "Request failed";
  }
}

export function EmailTemplatesPageClient() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplateListRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionWarning, setActionWarning] = useState<string | null>(null);
  const [mutationState, setMutationState] = useState<MutationState>({
    kind: null,
    templateId: null,
  });
  const isMutating = mutationState.kind !== null;

  async function loadTemplates() {
    setState((current) => (current === "ready" ? current : "loading"));
    setError(null);

    try {
      const response = await fetch("/api/admin/email-templates", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as TemplatesResponse;
      setTemplates(data.templates);
      setState("ready");
    } catch (loadError) {
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить шаблоны.");
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function handleCreateTemplate() {
    setMutationState({ kind: "create", templateId: null });
    setActionMessage(null);
    setActionWarning(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CUSTOM" }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { template: EmailTemplateListRow };
      router.push(`/admin/communications/email-studio/${data.template.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось создать шаблон.");
    } finally {
      setMutationState({ kind: null, templateId: null });
    }
  }

  async function handleDuplicateTemplate(templateId: string) {
    setMutationState({ kind: "duplicate", templateId });
    setActionMessage(null);
    setActionWarning(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { template: EmailTemplateListRow };
      setActionMessage(`Создан дубликат "${data.template.name}".`);
      await loadTemplates();
    } catch (duplicateError) {
      setError(
        duplicateError instanceof Error ? duplicateError.message : "Не удалось дублировать шаблон.",
      );
    } finally {
      setMutationState({ kind: null, templateId: null });
    }
  }

  async function handlePublishTemplate(templateId: string) {
    setMutationState({ kind: "publish", templateId });
    setActionMessage(null);
    setActionWarning(null);
    setError(null);

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
        template: EmailTemplateListRow;
        publishedVersion: number;
        warning?: { code: string; message: string };
      };

      setActionMessage(
        `Шаблон "${data.template.name}" опубликован как версия ${data.publishedVersion}.`,
      );
      if (data.warning) {
        setActionWarning(data.warning.message);
      }
      await loadTemplates();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Не удалось опубликовать шаблон.");
    } finally {
      setMutationState({ kind: null, templateId: null });
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    const target = templates.find((item) => item.id === templateId);
    const label = target?.name?.trim() || "этот шаблон";
    const isConfirmed = window.confirm(`Удалить шаблон "${label}"? Это действие нельзя отменить.`);
    if (!isConfirmed) return;

    setMutationState({ kind: "delete", templateId });
    setActionMessage(null);
    setActionWarning(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setActionMessage(`Шаблон "${label}" удалён.`);
      await loadTemplates();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить шаблон.");
    } finally {
      setMutationState({ kind: null, templateId: null });
    }
  }

  let content: React.ReactNode;

  if (state === "loading") {
    content = (
      <Card>
        <CardHeader>
          <CardTitle>Шаблоны</CardTitle>
          <CardDescription>Загружаем список шаблонов…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </CardContent>
      </Card>
    );
  } else if (state === "error") {
    content = (
      <Card>
        <CardHeader>
          <CardTitle>Шаблоны</CardTitle>
          <CardDescription>Не удалось загрузить Email Studio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || "Unknown error"}
          </div>
          <Button variant="outline" onClick={() => void loadTemplates()}>
            <RefreshCw className="size-4" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  } else if (templates.length === 0) {
    content = (
      <Card>
        <CardHeader>
          <CardTitle>Шаблоны</CardTitle>
          <CardDescription>
            Пока нет ни одного шаблона. Создайте первый draft, чтобы начать работу.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void handleCreateTemplate()} disabled={mutationState.kind === "create"}>
            {mutationState.kind === "create" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Создать шаблон
          </Button>
        </CardContent>
      </Card>
    );
  } else {
    content = (
      <Card>
        <CardHeader>
          <CardTitle>Шаблоны</CardTitle>
          <CardDescription>
            Все email-шаблоны в одном месте: черновики, опубликованные версии и рабочие сценарии.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {actionMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {actionMessage}
            </div>
          ) : null}
          {actionWarning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              ⚠️ {actionWarning}
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Название</th>
                  <th className="px-4 py-3 font-medium">Тип</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Обновлён</th>
                  <th className="px-4 py-3 font-medium">Версия</th>
                  <th className="px-4 py-3 font-medium text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {templates.map((template) => {
                  const isPublishing =
                    mutationState.kind === "publish" && mutationState.templateId === template.id;
                  const isDuplicating =
                    mutationState.kind === "duplicate" && mutationState.templateId === template.id;
                  const isDeleting =
                    mutationState.kind === "delete" && mutationState.templateId === template.id;

                  return (
                    <tr key={template.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-4">
                        <div className="font-medium text-foreground">{template.name}</div>
                        <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground">
                          {template.subject}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <div className="space-y-1">
                          <div className="text-foreground">
                            {getEmailTemplateTypeRuLabel(template.type)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getEmailTemplateClassificationLabel(
                              getEmailTemplateClassification(template.type),
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <EmailTemplateStatusBadge status={template.status} />
                          <div className="max-w-[220px] text-xs text-muted-foreground">
                            {getEmailTemplateStatusDescription(template.status)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatDate(template.updatedAt)}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">v{template.version}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/communications/email-studio/${template.id}`}>
                              <ExternalLink className="size-4" />
                              Открыть
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDuplicateTemplate(template.id)}
                            disabled={isMutating || isDuplicating}
                          >
                            {isDuplicating ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                            Дублировать
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void handlePublishTemplate(template.id)}
                            disabled={isMutating || isPublishing || template.status === "ARCHIVED"}
                          >
                            {isPublishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                            Опубликовать
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteTemplate(template.id)}
                            disabled={isMutating || isDeleting}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            {isDeleting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                            Удалить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Email Studio"
        subtitle="Часть домена «Коммуникации»: шаблоны, preview, тестовая отправка и версии в одном потоке."
        showBackButton={false}
        actions={
          <Button onClick={() => void handleCreateTemplate()} disabled={isMutating}>
            {mutationState.kind === "create" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Создать шаблон
          </Button>
        }
      />
      {content}
    </div>
  );
}
