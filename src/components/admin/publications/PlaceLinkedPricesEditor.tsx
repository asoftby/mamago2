"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Place } from "@prisma/client";
import { parsePriceData, type PriceData } from "@/lib/priceItems";
import { PriceListEditor } from "@/components/shared/PriceListEditor";

const DEBOUNCE_MS = 800;

export function PlaceLinkedPricesEditor({ placeId }: { placeId: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<PriceData>({ items: [], note: "" });
  const [originalData, setOriginalData] = useState<PriceData>({ items: [], note: "" });
  const [saving, setSaving] = useState(false);
  const [revisionLocked, setRevisionLocked] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<PriceData>({ items: [], note: "" });

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const loadPlace = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/business/places/${placeId}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || (err as { error?: string }).error || `Ошибка загрузки (${res.status})`,
        );
      }
      const json = (await res.json()) as { place: Place; activeRevision?: { status: string } | null };
      const loaded = parsePriceData(json.place.priceItems);
      setData(loaded);
      setOriginalData(loaded);
      if (json.place.status === "PUBLISHED" && json.activeRevision) {
        setRevisionLocked(json.activeRevision.status === "PENDING");
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Не удалось загрузить цены");
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    void loadPlace();
  }, [loadPlace]);

  const flushSave = useCallback(async () => {
    const current = dataRef.current;
    if (JSON.stringify(current) === JSON.stringify(originalData)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/business/places/${placeId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceItems: current }),  // current is PriceData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || (err as { error?: string }).error || "Не удалось сохранить",
        );
      }
      setOriginalData({ ...current });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения цен");
    } finally {
      setSaving(false);
    }
  }, [placeId, originalData]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void flushSave();
    }, DEBOUNCE_MS);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [placeId]);

  const handleChange = useCallback(
    (next: PriceData) => {
      if (revisionLocked) return;
      setData(next);
      scheduleSave();
    },
    [revisionLocked, scheduleSave],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Загрузка цен…
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  return (
    <div className="space-y-3">
      {revisionLocked && (
        <p className="text-sm text-muted-foreground rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2">
          Ревизия места на модерации — цены сейчас только для просмотра.
        </p>
      )}
      {saving && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Сохранение…
        </p>
      )}
      <PriceListEditor value={data} onChange={handleChange} disabled={revisionLocked} />
    </div>
  );
}
