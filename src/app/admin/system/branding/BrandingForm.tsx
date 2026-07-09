"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { uploadMediaFile } from "@/lib/uploads/uploadClient";
import { UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads/uploadConfig";
import type { BrandingConfig } from "@/lib/branding";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_TOKENS: {
  key: keyof Pick<
    BrandingConfig,
    "colorPrimary" | "colorAccent" | "colorBackground" | "colorSurface" | "colorText"
  >;
  label: string;
  cssHint: string;
}[] = [
  {
    key: "colorPrimary",
    label: "Основной цвет",
    cssHint: "--color-primary → перекрывает --primary",
  },
  {
    key: "colorAccent",
    label: "Акцентный цвет",
    cssHint: "--color-accent → перекрывает --accent",
  },
  {
    key: "colorBackground",
    label: "Фон страницы",
    cssHint: "--color-background → перекрывает --background",
  },
  {
    key: "colorSurface",
    label: "Поверхность",
    cssHint: "--color-surface → перекрывает --surface",
  },
  {
    key: "colorText",
    label: "Основной текст",
    cssHint:
      "--color-text → новая переменная — применится после внедрения в компоненты",
  },
];

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Nunito", label: "Nunito" },
  { value: "Raleway", label: "Raleway" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Georgia", label: "Georgia (системный)" },
  { value: "Arial", label: "Arial (системный)" },
];

const GOOGLE_FONTS = new Set([
  "Inter",
  "Roboto",
  "Montserrat",
  "Nunito",
  "Raleway",
  "Playfair Display",
]);

const FAVICON_IMAGE_ACCEPT = "image/png,image/webp,.png,.webp";

function isBrandingConfig(value: unknown): value is BrandingConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const hasValidLogoAssetId =
    candidate.logoAssetId === null || typeof candidate.logoAssetId === "string";
  const hasValidFaviconAssetId =
    candidate.faviconAssetId === null ||
    typeof candidate.faviconAssetId === "string";
  const hasValidLogoUrl =
    candidate.logoUrl === null || typeof candidate.logoUrl === "string";
  const hasValidFaviconUrl =
    candidate.faviconUrl === null || typeof candidate.faviconUrl === "string";
  const hasValidMimeType =
    candidate.faviconMimeType === null ||
    typeof candidate.faviconMimeType === "string";
  const hasValidVersion =
    candidate.faviconVersion === null ||
    typeof candidate.faviconVersion === "string";
  const hasValidColorsAndFonts =
    typeof candidate.colorPrimary === "string" &&
    typeof candidate.colorAccent === "string" &&
    typeof candidate.colorBackground === "string" &&
    typeof candidate.colorSurface === "string" &&
    typeof candidate.colorText === "string" &&
    typeof candidate.fontHeading === "string" &&
    typeof candidate.fontBody === "string";

  return (
    hasValidLogoAssetId &&
    hasValidFaviconAssetId &&
    hasValidLogoUrl &&
    hasValidFaviconUrl &&
    hasValidMimeType &&
    hasValidVersion &&
    hasValidColorsAndFonts
  );
}

// ─── Image uploader ───────────────────────────────────────────────────────────

function ImageUploader({
  label,
  hint,
  previewUrl,
  onUpload,
  onClear,
  accept = UPLOAD_IMAGE_ACCEPT,
}: {
  label: string;
  hint?: string;
  previewUrl: string | null;
  onUpload: (assetId: string, url: string) => void;
  onClear: () => void;
  accept?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const media = await uploadMediaFile(file);
      onUpload(media.id, media.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <div
        className={[
          "relative flex items-center justify-center rounded-xl border-2 border-dashed transition-colors cursor-pointer",
          uploading ? "opacity-50 cursor-not-allowed" : "hover:border-gray-400",
          previewUrl ? "border-gray-200 p-2" : "border-gray-300 p-8",
        ].join(" ")}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && !uploading) handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        ) : previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt={label}
              className="h-20 w-auto max-w-[200px] rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute -top-2 -right-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Upload className="h-8 w-8" />
            <span className="text-xs">Нажмите или перетащите</span>
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Color picker row ─────────────────────────────────────────────────────────

function ColorRow({
  label,
  cssHint,
  value,
  onChange,
}: {
  label: string;
  cssHint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);

  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="mt-0.5 font-mono text-xs text-gray-400">{cssHint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="color"
          value={isValidHex ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
        />
        <Input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || v === "#" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) {
              onChange(v);
            }
          }}
          className="h-9 w-28 font-mono text-sm uppercase"
          placeholder="#000000"
        />
        <div
          className="h-9 w-9 shrink-0 rounded-lg border border-gray-200"
          style={{ backgroundColor: isValidHex ? value : "transparent" }}
        />
      </div>
    </div>
  );
}

// ─── Font preview ─────────────────────────────────────────────────────────────

function FontPreview({
  fontHeading,
  fontBody,
}: {
  fontHeading: string;
  fontBody: string;
}) {
  const toImport = [...new Set([fontHeading, fontBody])].filter((f) =>
    GOOGLE_FONTS.has(f),
  );

  const importUrl =
    toImport.length > 0
      ? `https://fonts.googleapis.com/css2?${toImport.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&")}&display=swap`
      : null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-3">
      {importUrl && (
        // eslint-disable-next-line @next/next/no-css-tags
        <style>{`@import url('${importUrl}');`}</style>
      )}
      <p className="text-xs text-gray-400 font-mono mb-3">Preview</p>
      <p
        style={{ fontFamily: `"${fontHeading}", sans-serif` }}
        className="text-xl font-bold text-gray-900"
      >
        Заголовок страницы
      </p>
      <p
        style={{ fontFamily: `"${fontBody}", sans-serif` }}
        className="text-sm text-gray-600"
      >
        Основной текст сайта. Здесь отображается шрифт для контента — описания
        мест, статьи, подписи и прочее.
      </p>
    </div>
  );
}

// ─── Color preview card ───────────────────────────────────────────────────────

function ColorPreviewCard({
  colorPrimary,
  colorBackground,
  colorSurface,
  colorText,
  colorAccent,
}: {
  colorPrimary: string;
  colorBackground: string;
  colorSurface: string;
  colorText: string;
  colorAccent: string;
}) {
  return (
    <div
      className="rounded-xl border border-gray-200 p-4 space-y-3"
      style={{ backgroundColor: colorBackground }}
    >
      <p className="text-xs text-gray-400 font-mono">Preview</p>
      <div
        className="rounded-lg p-4 space-y-2"
        style={{ backgroundColor: colorSurface }}
      >
        <p className="text-base font-semibold" style={{ color: colorText }}>
          Парк Победы
        </p>
        <p className="text-xs" style={{ color: colorText, opacity: 0.6 }}>
          Место для прогулок · Минск
        </p>
        <div className="flex gap-2 mt-3">
          <button
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: colorPrimary }}
          >
            Добавить в план
          </button>
          <button
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: colorAccent + "22",
              color: colorAccent,
            }}
          >
            Подробнее
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function BrandingForm({ initial }: { initial: BrandingConfig }) {
  const router = useRouter();

  const [logoAssetId, setLogoAssetId] = useState<string | null>(
    initial.logoAssetId,
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    initial.logoUrl,
  );
  const [faviconAssetId, setFaviconAssetId] = useState<string | null>(
    initial.faviconAssetId,
  );
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | null>(
    initial.faviconUrl,
  );

  const [colorPrimary, setColorPrimary] = useState(initial.colorPrimary);
  const [colorAccent, setColorAccent] = useState(initial.colorAccent);
  const [colorBackground, setColorBackground] = useState(
    initial.colorBackground,
  );
  const [colorSurface, setColorSurface] = useState(initial.colorSurface);
  const [colorText, setColorText] = useState(initial.colorText);

  const [fontHeading, setFontHeading] = useState(initial.fontHeading);
  const [fontBody, setFontBody] = useState(initial.fontBody);

  const [saving, setSaving] = useState(false);

  const colorSetters: Record<
    (typeof COLOR_TOKENS)[number]["key"],
    (v: string) => void
  > = {
    colorPrimary: setColorPrimary,
    colorAccent: setColorAccent,
    colorBackground: setColorBackground,
    colorSurface: setColorSurface,
    colorText: setColorText,
  };

  const colorValues: Record<(typeof COLOR_TOKENS)[number]["key"], string> = {
    colorPrimary,
    colorAccent,
    colorBackground,
    colorSurface,
    colorText,
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoAssetId,
          faviconAssetId,
          colorPrimary,
          colorAccent,
          colorBackground,
          colorSurface,
          colorText,
          fontHeading,
          fontBody,
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        if (isBrandingConfig(data)) {
          setLogoAssetId(data.logoAssetId);
          setLogoPreviewUrl(data.logoUrl);
          setFaviconAssetId(data.faviconAssetId);
          setFaviconPreviewUrl(data.faviconUrl);
        }
        toast.success("Оформление сохранено");
        router.refresh();
      } else {
        const errorData = data as { error?: string } | null;
        toast.error(errorData?.error ?? "Ошибка сохранения");
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Секция 1 — Логотип и Favicon */}
      <Section title="Логотип и Favicon">
        <div className="grid grid-cols-2 gap-6">
          <ImageUploader
            label="Логотип"
            previewUrl={logoPreviewUrl}
            onUpload={(id, url) => {
              setLogoAssetId(id);
              setLogoPreviewUrl(url);
            }}
            onClear={() => {
              setLogoAssetId(null);
              setLogoPreviewUrl(null);
            }}
          />
          <ImageUploader
            label="Favicon"
            hint="Рекомендуется 32×32 или 64×64 px, формат PNG или WebP"
            accept={FAVICON_IMAGE_ACCEPT}
            previewUrl={faviconPreviewUrl}
            onUpload={(id, url) => {
              setFaviconAssetId(id);
              setFaviconPreviewUrl(url);
            }}
            onClear={() => {
              setFaviconAssetId(null);
              setFaviconPreviewUrl(null);
            }}
          />
        </div>
      </Section>

      {/* Секция 2 — Цвета */}
      <Section title="Цвета">
        <div className="space-y-2">
          {COLOR_TOKENS.map(({ key, label, cssHint }) => (
            <ColorRow
              key={key}
              label={label}
              cssHint={cssHint}
              value={colorValues[key]}
              onChange={colorSetters[key]}
            />
          ))}
        </div>
        <ColorPreviewCard
          colorPrimary={colorPrimary}
          colorBackground={colorBackground}
          colorSurface={colorSurface}
          colorText={colorText}
          colorAccent={colorAccent}
        />
      </Section>

      {/* Секция 3 — Типографика */}
      <Section title="Типографика">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-900">
              Шрифт заголовков
            </label>
            <p className="font-mono text-xs text-gray-400">
              --font-heading → новая переменная — применится после внедрения в
              компоненты
            </p>
            <Select value={fontHeading} onValueChange={setFontHeading}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-900">
              Шрифт текста
            </label>
            <p className="font-mono text-xs text-gray-400">
              --font-body → новая переменная — применится после внедрения в
              компоненты
            </p>
            <Select value={fontBody} onValueChange={setFontBody}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <FontPreview fontHeading={fontHeading} fontBody={fontBody} />
      </Section>

      {/* Кнопка сохранения */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="h-10 px-6 rounded-2xl bg-[#EF8759] text-white text-sm font-semibold hover:bg-[#e8784a] disabled:opacity-40 transition-colors flex items-center gap-2"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}
