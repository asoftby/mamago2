"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export type ImportMediaRow = { url: string; label: string };

export function ImportEventMediaIngest({ rows }: { rows: ImportMediaRow[] }) {
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [mediaIdByUrl, setMediaIdByUrl] = useState<Record<string, string>>({});

  async function ingest(url: string) {
    setBusyUrl(url);
    try {
      const res = await fetch("/api/media/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Ошибка загрузки");
      setMediaIdByUrl((prev) => ({ ...prev, [url]: j.mediaId }));
      toast.success("Изображение добавлено в медиатеку");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyUrl(null);
    }
  }

  return (
    <div className="space-y-3 mt-1">
      {rows.map((row) => (
        <div
          key={row.url}
          className="flex flex-wrap gap-3 items-start rounded-md border border-gray-200 bg-white p-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.url}
            alt=""
            className="h-20 w-20 shrink-0 rounded object-cover border border-gray-100"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-xs font-medium text-gray-700">{row.label}</div>
            <p className="text-[11px] text-gray-500 break-all">{row.url}</p>
            {mediaIdByUrl[row.url] ? (
              <p className="text-xs text-green-700 font-mono">mediaId: {mediaIdByUrl[row.url]}</p>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busyUrl !== null}
                onClick={() => void ingest(row.url)}
                className="gap-2"
              >
                {busyUrl === row.url ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                Загрузить в медиатеку
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
