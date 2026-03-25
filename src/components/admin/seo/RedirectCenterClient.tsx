"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import type {
  AutomaticRedirectRule,
  ManualRedirect,
  UnmatchedUrlRow,
  AutoRedirectRuleType,
  UnmatchedDetectedType,
  UnmatchedRowStatus,
} from "@/lib/admin/seo/redirectCenterTypes";

const RULE_TYPE_LABEL: Record<AutoRedirectRuleType, string> = {
  legacy_migration: "legacy migration",
  preset_mapping: "preset mapping",
  slug_normalization: "slug normalization",
  category_mapping: "category mapping",
};

const DETECTED_LABEL: Record<UnmatchedDetectedType, string> = {
  event: "Event",
  place: "Place",
  category: "Category",
  listing: "Listing",
  unknown: "Unknown",
};

const UNMATCHED_STATUS_LABEL: Record<UnmatchedRowStatus, string> = {
  new: "Новый",
  reviewed: "Проверен",
  ignored: "Игнор",
  resolved: "Решён",
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface RedirectCenterClientProps {
  initialAutomatic: AutomaticRedirectRule[];
  initialManual: ManualRedirect[];
  initialUnmatched: UnmatchedUrlRow[];
}

export function RedirectCenterClient({
  initialAutomatic,
  initialManual,
  initialUnmatched,
}: RedirectCenterClientProps) {
  const [tab, setTab] = useState("automatic");
  const [autoRules, setAutoRules] = useState(initialAutomatic);
  const [manualRows, setManualRows] = useState(initialManual);
  const [unmatchedRows, setUnmatchedRows] = useState(initialUnmatched);

  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [manualType, setManualType] = useState<"301" | "302">("301");
  const [manualNote, setManualNote] = useState("");

  const formId = useId();

  const toggleAuto = useCallback((id: string, enabled: boolean) => {
    setAutoRules((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, enabled, status: enabled ? "active" : "paused" }
          : r,
      ),
    );
  }, []);

  const addManual = useCallback(() => {
    const from = fromPath.trim();
    const to = toPath.trim();
    if (!from || !to) return;
    const row: ManualRedirect = {
      id: newId("mr"),
      from: from.startsWith("/") ? from : `/${from}`,
      to: to.startsWith("/") ? to : `/${to}`,
      redirectType: manualType,
      note: manualNote.trim() || null,
      status: "active",
      updatedAt: new Date().toISOString(),
    };
    setManualRows((prev) => [row, ...prev]);
    setFromPath("");
    setToPath("");
    setManualNote("");
  }, [fromPath, toPath, manualType, manualNote]);

  const unmatchedCount = useMemo(
    () => unmatchedRows.filter((u) => u.status === "new").length,
    [unmatchedRows],
  );

  const patchUnmatched = useCallback(
    (id: string, patch: Partial<UnmatchedUrlRow>) => {
      setUnmatchedRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  return (
    <div className="space-y-6">
      <SeoPageHeader
        title="Redirects"
        subtitle="Управление системными и ручными редиректами, очередь несопоставленных legacy URL"
        actions={
          <Button
            type="button"
            className="shrink-0 gap-2"
            onClick={() => {
              setTab("manual");
              document
                .getElementById(formId)
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Добавить редирект
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 p-1 sm:grid-cols-3">
          <TabsTrigger value="automatic" className="justify-center py-2.5">
            Automatic
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({autoRules.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="justify-center py-2.5">
            Manual
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({manualRows.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="unmatched" className="justify-center py-2.5">
            Unmatched
            {unmatchedCount > 0 ? (
              <Badge variant="destructive" className="ml-2 text-[10px]">
                {unmatchedCount}
              </Badge>
            ) : (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({unmatchedRows.length})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automatic" className="mt-6 space-y-3">
          <p className="text-sm text-gray-600">
            Системные правила из миграций и конфигов. Редактирование записей
            недоступно — только включение / отключение.
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50/90">
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      From URL
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      To URL
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Rule type
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Source
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Last checked
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      On
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {autoRules.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className="max-w-[200px] px-4 py-3 font-mono text-xs text-gray-800">
                        <span className="break-all">{row.fromUrl}</span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 font-mono text-xs text-gray-800">
                        <span className="break-all">{row.toUrl}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {RULE_TYPE_LABEL[row.ruleType]}
                        </Badge>
                      </td>
                      <td className="max-w-[160px] px-4 py-3 font-mono text-xs text-gray-600">
                        {row.source}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {row.status === "active" ? (
                          <span className="text-emerald-700">active</span>
                        ) : (
                          <span className="text-amber-800">paused</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {row.lastCheckedAt
                          ? format(
                              new Date(row.lastCheckedAt),
                              "d MMM yyyy, HH:mm",
                              { locale: ru },
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Switch
                          checked={row.enabled}
                          onCheckedChange={(v) => toggleAuto(row.id, v)}
                          aria-label={`Включить правило ${row.id}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-6 space-y-6">
          <div
            id={formId}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <h2 className="text-base font-semibold text-gray-900">
              Новый ручной редирект
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Путь относительно хоста; позже будет валидация коллизий и
              приоритетов.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${formId}-from`}>From path</Label>
                <Input
                  id={`${formId}-from`}
                  value={fromPath}
                  onChange={(e) => setFromPath(e.target.value)}
                  placeholder="/old/path"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${formId}-to`}>To path</Label>
                <Input
                  id={`${formId}-to`}
                  value={toPath}
                  onChange={(e) => setToPath(e.target.value)}
                  placeholder="/minsk/kuda"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Redirect type</Label>
                <Select
                  value={manualType}
                  onValueChange={(v) => setManualType(v as "301" | "302")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="301">301 Permanent</SelectItem>
                    <SelectItem value="302">302 Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${formId}-note`}>Note (optional)</Label>
                <Textarea
                  id={`${formId}-note`}
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Зачем нужен редирект…"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={addManual}>
                Сохранить в список
              </Button>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-900">
              Ручные правила
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-slate-50/90">
                      <th className="px-4 py-3 font-semibold text-gray-800">
                        From
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-800">
                        To
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-800">
                        Type
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-800">
                        Note
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-800">
                        Status
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-800">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {manualRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">
                          {row.from}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">
                          {row.to}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                          {row.redirectType}
                        </td>
                        <td className="max-w-[200px] px-4 py-3 text-xs text-gray-600">
                          {row.note ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {row.status}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {format(new Date(row.updatedAt), "d MMM yyyy, HH:mm", {
                            locale: ru,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="unmatched" className="mt-6 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
            <strong className="font-semibold">Unmatched URLs</strong> — legacy
            адреса без однозначного сопоставления. Используйте для миграции и
            SEO-пресетов.
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50/90">
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Legacy URL
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Detected type
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Suggested target
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-800">
                      Status
                    </th>
                    <th className="w-28 px-2 py-3 font-semibold text-gray-800">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unmatchedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className="max-w-[260px] px-4 py-3 font-mono text-xs text-gray-800">
                        <span className="break-all">{row.legacyUrl}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {DETECTED_LABEL[row.detectedType]}
                      </td>
                      <td className="max-w-[220px] px-4 py-3 font-mono text-xs text-gray-600">
                        {row.suggestedTarget ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs font-medium",
                            row.status === "new" &&
                              "border-blue-200 bg-blue-50 text-blue-900",
                            row.status === "reviewed" &&
                              "border-gray-200 bg-gray-100 text-gray-800",
                            row.status === "ignored" &&
                              "border-gray-200 bg-gray-50 text-gray-600",
                            row.status === "resolved" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-900",
                          )}
                        >
                          {UNMATCHED_STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td className="px-1 py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Действия"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => {
                                let from = row.legacyUrl;
                                try {
                                  if (/^https?:\/\//i.test(row.legacyUrl)) {
                                    from = new URL(row.legacyUrl).pathname;
                                  }
                                } catch {
                                  from = row.legacyUrl;
                                }
                                patchUnmatched(row.id, { status: "resolved" });
                                const suggested = row.suggestedTarget;
                                if (suggested) {
                                  setManualRows((prev) => [
                                    {
                                      id: newId("mr"),
                                      from,
                                      to: suggested,
                                      redirectType: "301",
                                      note: `from unmatched ${row.id}`,
                                      status: "active",
                                      updatedAt: new Date().toISOString(),
                                    },
                                    ...prev,
                                  ]);
                                }
                              }}
                            >
                              Create manual redirect
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() =>
                                patchUnmatched(row.id, { status: "ignored" })
                              }
                            >
                              Ignore
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() =>
                                patchUnmatched(row.id, { status: "reviewed" })
                              }
                            >
                              Mark reviewed
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
