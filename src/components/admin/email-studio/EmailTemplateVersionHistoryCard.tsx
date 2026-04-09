"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type EmailTemplateVersionHistoryItem = {
  id: string;
  templateId: string;
  version: number;
  createdAt: string;
  createdByUserId: string | null;
  createdBy: {
    id: string;
    email: string;
    displayName: string | null;
    label: string;
  } | null;
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

export function EmailTemplateVersionHistoryCard({
  templateId,
  currentVersion,
}: {
  templateId: string;
  currentVersion: number;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [versions, setVersions] = useState<EmailTemplateVersionHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadVersions = useCallback(async () => {
    setState((current) => (current === "ready" ? current : "loading"));
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}/versions`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { versions: EmailTemplateVersionHistoryItem[] };
      setVersions(data.versions);
      setState("ready");
    } catch (loadError) {
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить версии.");
    } finally {
      setRefreshing(false);
    }
  }, [templateId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions, currentVersion]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>История версий</CardTitle>
        <CardDescription>
          Список опубликованных версий. Черновик появится здесь только после publish.
        </CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadVersions()}>
            {refreshing ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Обновить
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : null}

        {state === "error" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error || "Не удалось загрузить историю версий."}
            </div>
            <Button type="button" variant="outline" onClick={() => void loadVersions()}>
              <RefreshCw className="size-4" />
              Повторить
            </Button>
          </div>
        ) : null}

        {state === "ready" && versions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            Пока нет опубликованных версий. Первый snapshot появится после publish.
          </div>
        ) : null}

        {state === "ready" && versions.length > 0 ? (
          <div className="space-y-3">
            {versions.map((version) => {
              const isCurrentPublished = version.version === currentVersion;

              return (
                <div
                  key={version.id}
                  className="rounded-xl border border-border bg-muted/10 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">v{version.version}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(version.createdAt)}
                      </div>
                    </div>
                    {isCurrentPublished ? (
                      <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        Текущая
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Опубликовано:</span>{" "}
                    {version.createdBy?.label || "System"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
