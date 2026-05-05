"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  coverUrl: string | null;
  onChange: (url: string | null) => void;
}

export function WizardStep3Cover({ coverUrl, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const url = URL.createObjectURL(file);
    setTimeout(() => {
      onChange(url);
      setUploading(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Обложка</h2>
        <p className="text-sm text-muted-foreground">
          Изображение для превью в каталоге и SEO-сниппетов
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />

      {!coverUrl ? (
        /* ── Empty state ── */
        <div
          className={cn(
            "flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-6 py-10 text-center transition-colors",
            !uploading && "hover:border-[#EF8759]/40 hover:bg-orange-50/30",
          )}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const f = e.dataTransfer.files?.[0];
            if (f?.type.startsWith("image/")) {
              setUploading(true);
              const url = URL.createObjectURL(f);
              setTimeout(() => { onChange(url); setUploading(false); }, 800);
            }
          }}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <ImagePlus className="h-7 w-7 text-gray-400" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">Обложка пока не выбрана</p>
            <p className="text-xs text-muted-foreground">
              Добавьте изображение для превью статьи и SEO-сниппетов
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
              )}
              {uploading ? "Загружаем…" : "Загрузить"}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Filled state ── */
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* 16:9 preview */}
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Обложка"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Заменить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onChange(null)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Удалить
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
