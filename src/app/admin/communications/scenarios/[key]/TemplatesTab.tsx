"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/features/notifications/store/notification-store";
import { Bell, Mail, MessageCircle, RefreshCw, RotateCcw, Send, Save } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScenarioTemplateDefault } from "@/lib/notifications/notificationRegistry";

type Channel = "IN_APP" | "EMAIL" | "TELEGRAM";

/** Plain serializable version of the scenario definition — no Zod objects. */
export type ScenarioDefinitionProps = {
  variables: string[];
  defaults: Partial<Record<Channel, ScenarioTemplateDefault>>;
};

export type SavedTemplate = {
  channel: Channel;
  subject: string | null;
  body: string;
  updatedAt: string;
  updatedByEmail: string | null;
};

type TemplateEditorProps = {
  scenarioKey: string;
  channel: Channel;
  scenarioDef: ScenarioDefinitionProps;
  savedTemplate: SavedTemplate | null;
  hasTelegramLinked: boolean;
  onSaved: (template: SavedTemplate) => void;
  onReset: () => void;
};

const CHANNEL_META: Record<Channel, { label: string; icon: React.ReactNode }> = {
  IN_APP: { label: "In-app", icon: <Bell className="h-4 w-4" /> },
  EMAIL: { label: "Email", icon: <Mail className="h-4 w-4" /> },
  TELEGRAM: { label: "Telegram", icon: <MessageCircle className="h-4 w-4" /> },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ru-BY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function VariableHints({
  variables,
  onInsert,
}: {
  variables: string[];
  onInsert: (variable: string) => void;
}) {
  if (variables.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 font-mono text-[11px] text-stone-700 transition-colors hover:border-stone-400 hover:bg-white"
          title={`Вставить {{${v}}}`}
        >
          {`{{${v}}}`}
        </button>
      ))}
    </div>
  );
}

function TemplateEditor({
  scenarioKey,
  channel,
  scenarioDef,
  savedTemplate,
  hasTelegramLinked,
  onSaved,
  onReset,
}: TemplateEditorProps) {
  const router = useRouter();
  const defaultEntry = scenarioDef.defaults[channel] as ScenarioTemplateDefault | undefined;
  const variables = scenarioDef.variables;

  const initialSubject = savedTemplate?.subject ?? (
    defaultEntry?.kind === "template" ? (defaultEntry.subject ?? "") : ""
  );
  const initialBody = savedTemplate?.body ?? (
    defaultEntry?.kind === "template" ? defaultEntry.body : ""
  );

  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [preview, setPreview] = useState<{ subject: string | null; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState(false);

  const subjectRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const insertVariable = useCallback(
    (variable: string) => {
      const token = `{{${variable}}}`;
      const target = lastFocused.current === "subject" ? subjectRef.current : bodyRef.current;
      if (!target) return;

      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? start;
      const newValue = target.value.slice(0, start) + token + target.value.slice(end);

      if (lastFocused.current === "subject") {
        setSubject(newValue);
      } else {
        setBody(newValue);
      }

      requestAnimationFrame(() => {
        target.focus();
        target.selectionStart = start + token.length;
        target.selectionEnd = start + token.length;
      });
    },
    [],
  );

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const resp = await fetch(
        `/api/admin/communications/scenarios/${scenarioKey}/templates/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ channel, subject: subject || null, body }),
        },
      );
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        rendered?: { subject: string | null; body: string };
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        toast.error(data.error ?? "Ошибка превью");
        return;
      }
      setPreview(data.rendered ?? null);
    } catch {
      toast.error("Не удалось получить превью");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch(
        `/api/admin/communications/scenarios/${scenarioKey}/templates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ channel, subject: subject || null, body }),
        },
      );
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        template?: SavedTemplate & { updatedAt: string };
        error?: string;
        unknownVariables?: string[];
      };
      if (!resp.ok || !data.ok) {
        if (data.unknownVariables?.length) {
          toast.error(`Неизвестные переменные: ${data.unknownVariables.join(", ")}`);
        } else {
          toast.error(data.error ?? "Ошибка сохранения");
        }
        return;
      }
      toast.success("Шаблон сохранён");
      onSaved({
        channel,
        subject: data.template?.subject ?? null,
        body: data.template?.body ?? body,
        updatedAt: data.template?.updatedAt ?? new Date().toISOString(),
        updatedByEmail: data.template?.updatedByEmail ?? null,
      });
      router.refresh();
    } catch {
      toast.error("Не удалось сохранить шаблон");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const resp = await fetch(
        `/api/admin/communications/scenarios/${scenarioKey}/templates?channel=${channel}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Ошибка сброса");
        return;
      }
      toast.success("Шаблон сброшен до системного дефолта");
      setSubject(defaultEntry?.kind === "template" ? (defaultEntry.subject ?? "") : "");
      setBody(defaultEntry?.kind === "template" ? defaultEntry.body : "");
      setPreview(null);
      onReset();
      router.refresh();
    } catch {
      toast.error("Не удалось сбросить шаблон");
    } finally {
      setResetting(false);
    }
  };

  const channelLabel = CHANNEL_META[channel].label;

  const handleTest = async () => {
    if (channel === "TELEGRAM" && !hasTelegramLinked) {
      toast.error("Telegram не подключён. Привяжите Telegram в настройках профиля, чтобы получить тестовое сообщение.");
      return;
    }

    setTesting(true);
    try {
      const resp = await fetch(
        `/api/admin/communications/scenarios/${scenarioKey}/templates/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ channel, subject: subject || null, body }),
        },
      );
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
        error?: string;
      };

      if (!resp.ok || !data.ok) {
        toast.error(data.error ?? "Не удалось отправить тест");
        return;
      }

      toast.success(`Тест отправлен в ${channelLabel}`);

      if (channel === "IN_APP") {
        void useNotificationStore.getState().refreshUnreadOnly({ force: true });
      }
    } catch {
      toast.error("Не удалось отправить тестовое уведомление");
    } finally {
      setTesting(false);
    }
  };

  const isOverride = Boolean(savedTemplate);
  const showSubject = channel !== "TELEGRAM";
  const isCodeDefault = defaultEntry?.kind === "code";

  return (
    <div className="space-y-5">
      {isCodeDefault && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <span className="font-medium">Transactional:</span> дефолт рендерится кодом (
          {(defaultEntry as { kind: "code"; note: string }).note}
          ). Override заменяет его полностью.
        </div>
      )}

      {isOverride && savedTemplate && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <span>
            Активен override · обновлён {formatDate(savedTemplate.updatedAt)}
            {savedTemplate.updatedByEmail ? ` (${savedTemplate.updatedByEmail})` : ""}
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium">Override</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Переменные
          </span>
          <span className="text-xs text-stone-400">кликните для вставки в курсор</span>
        </div>
        <VariableHints variables={variables} onInsert={insertVariable} />
      </div>

      {showSubject && (
        <div className="space-y-1.5">
          <Label htmlFor={`subject-${channel}`} className="text-sm text-stone-700">
            Тема
          </Label>
          <textarea
            id={`subject-${channel}`}
            ref={subjectRef}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => {
              lastFocused.current = "subject";
            }}
            rows={2}
            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-2.5 font-mono text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400"
            placeholder="Тема письма / заголовок уведомления"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`body-${channel}`} className="text-sm text-stone-700">
          Текст
          {channel === "EMAIL" && (
            <span className="ml-2 text-xs font-normal text-stone-500">
              Поддерживается HTML (p, b, i, a, ul/ol, h2–h4, blockquote)
            </span>
          )}
          {channel === "TELEGRAM" && (
            <span className="ml-2 text-xs font-normal text-stone-500">
              Поддерживается Telegram HTML (b, i, a, code, pre, blockquote)
            </span>
          )}
        </Label>
        <textarea
          id={`body-${channel}`}
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => {
            lastFocused.current = "body";
          }}
          rows={channel === "EMAIL" ? 10 : 5}
          className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-2.5 font-mono text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400"
          placeholder={
            channel === "EMAIL"
              ? "<p>Текст письма с {{переменными}}</p>"
              : "Текст уведомления с {{переменными}}"
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void handleSave()}
          disabled={saving || !body.trim()}
          className="rounded-2xl"
        >
          <Save className="h-4 w-4" />
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>

        <Button
          variant="outline"
          onClick={() => void handlePreview()}
          disabled={previewLoading || !body.trim()}
          className="rounded-2xl"
        >
          <RefreshCw className={`h-4 w-4 ${previewLoading ? "animate-spin" : ""}`} />
          Превью
        </Button>

        {isOverride && (
          <Button
            variant="outline"
            onClick={() => void handleReset()}
            disabled={resetting}
            className="rounded-2xl text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <RotateCcw className="h-4 w-4" />
            {resetting ? "Сброс…" : "Сбросить"}
          </Button>
        )}

        <div className="ml-auto flex flex-col items-end gap-1">
          <Button
            variant="outline"
            onClick={() => void handleTest()}
            disabled={testing}
            className="rounded-2xl"
          >
            <Send className="h-4 w-4" />
            {testing ? "Отправляем…" : `Тест в ${channelLabel}`}
          </Button>
          {channel === "TELEGRAM" && !hasTelegramLinked && (
            <p className="text-xs text-rose-600">
              Telegram не подключён — тест недоступен
            </p>
          )}
        </div>
      </div>

      {preview && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Превью (с sample-данными)
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 text-sm">
            {preview.subject && (
              <div className="mb-2 font-semibold text-stone-900">{preview.subject}</div>
            )}
            {channel === "EMAIL" ? (
              <div
                className="prose prose-sm max-w-none text-stone-700"
                dangerouslySetInnerHTML={{ __html: preview.body }}
              />
            ) : (
              <div className="whitespace-pre-line text-stone-700">{preview.body}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type TemplatesTabProps = {
  scenarioKey: string;
  scenarioDef: ScenarioDefinitionProps;
  savedTemplates: SavedTemplate[];
  initialChannel: Channel;
  hasTelegramLinked: boolean;
};

export function TemplatesTab({
  scenarioKey,
  scenarioDef,
  savedTemplates,
  initialChannel,
  hasTelegramLinked,
}: TemplatesTabProps) {
  const availableChannels = (["IN_APP", "EMAIL", "TELEGRAM"] as Channel[]).filter(
    (ch) => ch in scenarioDef.defaults,
  );

  const activeChannel = availableChannels.includes(initialChannel) ? initialChannel : availableChannels[0];

  const [templates, setTemplates] = useState<Record<Channel, SavedTemplate | null>>(
    () =>
      Object.fromEntries(
        availableChannels.map((ch) => [ch, savedTemplates.find((t) => t.channel === ch) ?? null]),
      ) as Record<Channel, SavedTemplate | null>,
  );

  const handleSaved = (channel: Channel, template: SavedTemplate) => {
    setTemplates((prev) => ({ ...prev, [channel]: template }));
  };

  const handleReset = (channel: Channel) => {
    setTemplates((prev) => ({ ...prev, [channel]: null }));
  };

  if (availableChannels.length === 0) {
    return (
      <div className="rounded-2xl bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
        Для этого сценария шаблоны по каналам не настроены.
      </div>
    );
  }

  return (
    <Card className="rounded-3xl border-stone-200/90">
      <CardHeader>
        <CardTitle>Шаблоны по каналам</CardTitle>
        <CardDescription>
          Override заменяет системный дефолт. Сбросить — удалить override и вернуть дефолт из кода.
          Все переменные <code className="text-xs">{"{{var}}"}</code> подставляются в момент
          отправки.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={activeChannel}>
          <TabsList className="mb-6 rounded-2xl">
            {availableChannels.map((ch) => {
              const meta = CHANNEL_META[ch];
              const hasOverride = Boolean(templates[ch]);
              return (
                <TabsTrigger key={ch} value={ch} className="flex items-center gap-2 rounded-xl">
                  {meta.icon}
                  {meta.label}
                  {hasOverride && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Override активен" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {availableChannels.map((ch) => (
            <TabsContent key={ch} value={ch}>
              <TemplateEditor
                scenarioKey={scenarioKey}
                channel={ch}
                scenarioDef={scenarioDef}
                savedTemplate={templates[ch]}
                hasTelegramLinked={hasTelegramLinked}
                onSaved={(t) => handleSaved(ch, t)}
                onReset={() => handleReset(ch)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
