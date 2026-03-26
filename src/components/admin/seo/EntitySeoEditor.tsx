"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type EntitySeoEditorKind = "event" | "place" | "offer" | "route" | "article";

export type EntitySeoEditorModel = {
  id: string;
  title: string;
  summary: string;
  slug: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoH1: string | null;
  seoCanonicalUrl: string | null;
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  seoOgImage: string | null;
  seoRobots: string | null;
  seoJsonLdOverride: unknown | null;
};

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
  entity: EntitySeoEditorModel;
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
  const [seoRobots, setSeoRobots] = useState(safeStr(entity.seoRobots || "index,follow"));
  const [seoJsonLdOverride, setSeoJsonLdOverride] = useState(
    entity.seoJsonLdOverride ? JSON.stringify(entity.seoJsonLdOverride, null, 2) : ""
  );

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
        seoRobots: seoRobots.trim() || null,
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <div className="text-sm font-semibold">Slug</div>
          <div className="text-xs text-gray-500 mt-1">
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
          <div className="text-sm font-semibold">H1</div>
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

        <div>
          <div className="text-sm font-semibold">Canonical</div>
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
            <Input value={seoOgTitle} onChange={(e) => setSeoOgTitle(e.target.value)} className="mt-2" />
          </div>
          <div>
            <div className="text-sm font-semibold">OG image</div>
            <Input value={seoOgImage} onChange={(e) => setSeoOgImage(e.target.value)} className="mt-2" />
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold">OG description</div>
          <Textarea value={seoOgDescription} onChange={(e) => setSeoOgDescription(e.target.value)} className="mt-2 min-h-[90px]" />
        </div>

        <div>
          <div className="text-sm font-semibold">Robots</div>
          <Input value={seoRobots} onChange={(e) => setSeoRobots(e.target.value)} placeholder="index,follow" className="mt-2" />
        </div>

        <div>
          <div className="text-sm font-semibold">JSON-LD override</div>
          <Textarea
            value={seoJsonLdOverride}
            onChange={(e) => setSeoJsonLdOverride(e.target.value)}
            placeholder='{"@context":"https://schema.org","@type":"...",...}'
            className="mt-2 font-mono text-xs min-h-[160px]"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Сохраняю…" : "Сохранить"}
          </Button>
          {ok && <div className="text-sm text-emerald-700">{ok}</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="text-sm font-semibold">Google snippet preview</div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-1">{preview.u || "https://mamago.by/…"}</div>
          <div className="text-[15px] leading-snug text-blue-800">{preview.t}</div>
          <div className="text-sm text-gray-700 mt-1">{preview.d}</div>
        </div>

        <div className="text-xs text-gray-500">
          Fallback: если поле пустое, используем данные сущности (title/summary) и canonical по public URL.
        </div>
      </div>
    </div>
  );
}

