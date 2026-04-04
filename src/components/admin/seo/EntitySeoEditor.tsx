"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Toggle } from "@/components/ui/Toggle";
import type { SeoEntityEditorModel } from "@/lib/admin/seo/entities/types";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";
import { cn } from "@/lib/utils";
import { SeoEntityDiagnosticsCard } from "./SeoEntityDiagnosticsCard";

export type EntitySeoEditorKind = "event" | "place" | "offer" | "route" | "article";

export type { SeoEntityEditorModel };

const ENTITY_TYPE_LABEL: Record<EntitySeoEditorKind, string> = {
  event: "Event",
  place: "Place",
  offer: "Offer",
  route: "Route",
  article: "Article",
};

const SECTION_LABEL: Record<EntitySeoEditorKind, string> = {
  event: "События",
  place: "Куда",
  offer: "Дни рождения",
  route: "Маршруты",
  article: "Журнал",
};

function humanizeEnumToken(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function humanizeContentStatus(raw: string): string {
  if (raw.includes("/")) {
    return raw
      .split("/")
      .map((part) => humanizeEnumToken(part.trim()))
      .join(" · ");
  }
  return humanizeEnumToken(raw);
}

function safeStr(x: string | null | undefined) {
  return x ?? "";
}

function endpointFor(kind: EntitySeoEditorKind, id: string) {
  if (kind === "event") return `/api/admin/seo/activity/${id}`;
  if (kind === "place") return `/api/admin/seo/place/${id}`;
  if (kind === "offer") return `/api/admin/seo/offer/${id}`;
  if (kind === "route") return `/api/admin/seo/route/${id}`;
  return `/api/admin/seo/article/${id}`;
}

export function EntitySeoEditor({
  kind,
  entity,
}: {
  kind: EntitySeoEditorKind;
  entity: SeoEntityEditorModel;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [slug, setSlug] = useState(safeStr(entity.slug));
  const [seoTitle, setSeoTitle] = useState(safeStr(entity.seoTitle));
  const [seoDescription, setSeoDescription] = useState(safeStr(entity.seoDescription));
  const [seoH1, setSeoH1] = useState(safeStr(entity.seoH1));
  const [seoCanonicalUrl, setSeoCanonicalUrl] = useState(safeStr(entity.seoCanonicalUrl));
  const [seoOgTitle, setSeoOgTitle] = useState(safeStr(entity.seoOgTitle));
  const [seoOgDescription, setSeoOgDescription] = useState(safeStr(entity.seoOgDescription));
  const [seoOgImage, setSeoOgImage] = useState(safeStr(entity.seoOgImage));
  const [indexFollow, setIndexFollow] = useState(() => {
    const r = (entity.seoRobots ?? "").toLowerCase();
    return !r.includes("noindex");
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [seoJsonLdOverride, setSeoJsonLdOverride] = useState(
    entity.seoJsonLdOverride ? JSON.stringify(entity.seoJsonLdOverride, null, 2) : "",
  );

  const effectiveH1 = useMemo(() => {
    const trimmed = seoH1.trim();
    return trimmed || entity.title;
  }, [seoH1, entity.title]);

  const h1IsCustom = seoH1.trim().length > 0;

  const metaLine = useMemo(() => {
    const parts: string[] = [
      ENTITY_TYPE_LABEL[kind],
      SECTION_LABEL[kind],
      humanizeContentStatus(entity.contentStatus),
    ];
    const city = entity.citySlug?.trim();
    if (city) parts.push(city);
    return parts.join(" · ");
  }, [kind, entity.contentStatus, entity.citySlug]);

  const preview = useMemo(() => {
    const t = seoTitle.trim() || entity.title;
    const d = seoDescription.trim() || entity.summary;
    const u = (seoCanonicalUrl.trim() || "").replace(/^https?:\/\/[^/]+/i, "");
    return { t, d, u };
  }, [seoTitle, seoDescription, seoCanonicalUrl, entity.title, entity.summary]);

  async function save() {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload = {
        slug: slug.trim() || null,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        seoH1: seoH1.trim() || null,
        seoCanonicalUrl: seoCanonicalUrl.trim() || null,
        seoOgTitle: seoOgTitle.trim() || null,
        seoOgDescription: seoOgDescription.trim() || null,
        seoOgImage: seoOgImage.trim() || null,
        seoRobots: indexFollow ? SEO_ROBOTS_INDEX_FOLLOW : SEO_ROBOTS_NOINDEX_FOLLOW,
        seoJsonLdOverride: seoJsonLdOverride.trim() ? JSON.parse(seoJsonLdOverride) : null,
      };

      const res = await fetch(endpointFor(kind, entity.id), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setOk("Сохранено");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-gray-100 pb-6">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-2xl font-bold leading-snug text-gray-900">{effectiveH1}</h1>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Badge variant={h1IsCustom ? "default" : "secondary"}>
              {h1IsCustom ? "Custom H1" : "Fallback from entity"}
            </Badge>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-600">{metaLine}</p>
      </header>

      {entity.urlDiagnostics ? (
        <SeoEntityDiagnosticsCard d={entity.urlDiagnostics} canonicalDraft={seoCanonicalUrl} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <div className="text-sm font-semibold">Slug (URL)</div>
            <div className="mt-1 text-xs text-gray-500">
              Меняется только вручную. При изменении сохраняем redirect со старого slug.
            </div>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-seo-slug"
              className="mt-2"
            />
          </div>

          <div>
            <div className="text-sm font-semibold">Page title (H1)</div>
            <div className="mt-1 text-xs text-gray-500">
              Если поле пустое, используется заголовок сущности
            </div>
            <Input
              value={seoH1}
              onChange={(e) => setSeoH1(e.target.value)}
              placeholder={entity.title}
              className="mt-2"
            />
          </div>

          <div>
            <div className="text-sm font-semibold">Meta title</div>
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={`${entity.title} — mamaGo`}
              className="mt-2"
            />
          </div>

          <div>
            <div className="text-sm font-semibold">Meta description</div>
            <Textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder={entity.summary}
              className="mt-2 min-h-[110px]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold">Индексация</div>
              <div className="text-xs text-gray-500">
                {indexFollow ? "index, follow" : "noindex, follow"}
              </div>
            </div>
            <Toggle
              checked={indexFollow}
              onChange={setIndexFollow}
              aria-label="Индексация: включить index, follow или noindex, follow"
            />
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100"
              >
                Advanced
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-gray-600 transition-transform",
                    advancedOpen && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-4 border-t border-gray-100 pt-4">
                <div>
                  <div className="text-sm font-semibold">Canonical</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Если пусто — используется public URL страницы
                  </div>
                  <Input
                    value={seoCanonicalUrl}
                    onChange={(e) => setSeoCanonicalUrl(e.target.value)}
                    placeholder="https://mamago.by/..."
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold">OG title</div>
                    <Input
                      value={seoOgTitle}
                      onChange={(e) => setSeoOgTitle(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">OG image</div>
                    <Input
                      value={seoOgImage}
                      onChange={(e) => setSeoOgImage(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">OG description</div>
                  <Textarea
                    value={seoOgDescription}
                    onChange={(e) => setSeoOgDescription(e.target.value)}
                    className="mt-2 min-h-[90px]"
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold">Schema (JSON-LD override)</div>
                  <Textarea
                    value={seoJsonLdOverride}
                    onChange={(e) => setSeoJsonLdOverride(e.target.value)}
                    placeholder='{"@context":"https://schema.org","@type":"...",...}'
                    className="mt-2 min-h-[160px] font-mono text-xs"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Сохраняю…" : "Сохранить"}
            </Button>
            {ok && <div className="text-sm text-emerald-700">{ok}</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold">Google snippet preview</div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-1 text-xs text-gray-600">{preview.u || "https://mamago.by/…"}</div>
            <div className="text-[15px] leading-snug text-blue-800">{preview.t}</div>
            <div className="mt-1 text-sm text-gray-700">{preview.d}</div>
          </div>

          <div className="text-xs text-gray-500">
            Fallback: если поле пустое, используем данные сущности (title/summary) и canonical по public URL.
          </div>
        </div>
      </div>
    </div>
  );
}
