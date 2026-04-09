"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminPath } from "@/components/admin/AdminNav";

type Preview = {
  publicUrl: string | null;
  alt: string | null;
  filename: string;
} | null;

export function MediaIdField({
  label,
  value,
  onChange,
  previewUrl: initialPreview,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  previewUrl?: string | null;
}) {
  const [preview, setPreview] = useState<Preview>(null);

  useEffect(() => {
    if (!value.trim()) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/articles/media-preview?id=${encodeURIComponent(value.trim())}`);
      if (!res.ok) {
        if (!cancelled) setPreview(null);
        return;
      }
      const data = (await res.json()) as {
        id: string;
        publicUrl: string | null;
        alt: string | null;
        filename: string;
      };
      if (!cancelled) setPreview(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  const url = preview?.publicUrl || initialPreview || null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button type="button" variant="link" className="h-auto p-0 text-xs" asChild>
          <Link href={adminPath("/media")} target="_blank">
            Медиатека
          </Link>
        </Button>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ID файла из медиатеки"
        className="font-mono text-xs"
      />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={preview?.alt || ""}
          className="max-h-40 rounded-lg border border-gray-200 object-contain"
        />
      ) : null}
    </div>
  );
}
