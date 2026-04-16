"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Place } from "@prisma/client";
import { PlaceInstagramField, PlacePhoneWebsiteFields } from "@/components/business/wizard/place/steps/placeContactFields";
import type { PlaceFormData } from "@/components/business/wizard/place/types";
import { mapPlaceToFormData, extractChanges } from "@/components/business/wizard/place/mappers";

const CONTACT_DEBOUNCE_MS = 700;

const CONTACT_KEYS = new Set([
  "phone",
  "website",
  "instagramHandle",
  "instagramUrl",
]);

function pickContactChanges(
  changes: ReturnType<typeof extractChanges>,
): Partial<Pick<Place, "phone" | "website" | "instagramHandle" | "instagramUrl">> {
  const out: Partial<Pick<Place, "phone" | "website" | "instagramHandle" | "instagramUrl">> = {};
  for (const key of CONTACT_KEYS) {
    if (key in changes) {
      (out as Record<string, unknown>)[key] = (changes as Record<string, unknown>)[key];
    }
  }
  return out;
}

type ActiveRevisionLite = {
  id: string;
  status: string;
  phone?: string | null;
  website?: string | null;
  instagramHandle?: string | null;
  instagramUrl?: string | null;
};

function mergeContactsFromRevision(
  place: Place,
  activeRevision: ActiveRevisionLite | null | undefined,
): Pick<PlaceFormData, "phone" | "website" | "instagramHandle" | "instagramUrl"> {
  if (!activeRevision) {
    return {
      phone: place.phone,
      website: place.website,
      instagramHandle: place.instagramHandle,
      instagramUrl: place.instagramUrl,
    };
  }
  return {
    phone: activeRevision.phone ?? place.phone,
    website: activeRevision.website ?? place.website,
    instagramHandle: activeRevision.instagramHandle ?? place.instagramHandle,
    instagramUrl: activeRevision.instagramUrl ?? place.instagramUrl,
  };
}

export function PlaceLinkedContactsEditor({ placeId }: { placeId: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlaceFormData | null>(null);
  const [originalFormData, setOriginalFormData] = useState<PlaceFormData | null>(null);
  const [placeStatus, setPlaceStatus] = useState<string | null>(null);
  const [revisionLocked, setRevisionLocked] = useState(false);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDataRef = useRef<PlaceFormData | null>(null);
  const originalRef = useRef<PlaceFormData | null>(null);
  const revisionIdRef = useRef<string | null>(null);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    originalRef.current = originalFormData;
  }, [originalFormData]);

  const loadPlace = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/business/places/${placeId}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message ||
            (err as { error?: string }).error ||
            `Ошибка загрузки (${res.status})`,
        );
      }
      const json = (await res.json()) as {
        place: Place & { images?: unknown[] };
        activeRevision?: ActiveRevisionLite | null;
      };
      const { place, activeRevision } = json;
      setPlaceStatus(place.status);

      const merged = mergeContactsFromRevision(place, activeRevision ?? null);
      const base = mapPlaceToFormData({
        ...place,
        images: place.images as any,
      });
      const next: PlaceFormData = {
        ...base,
        ...merged,
      };
      setFormData(next);
      setOriginalFormData({ ...next });

      if (place.status === "PUBLISHED" && activeRevision) {
        setRevisionId(activeRevision.id);
        revisionIdRef.current = activeRevision.id;
        setRevisionLocked(activeRevision.status === "PENDING");
      } else {
        const rid = activeRevision?.id ?? null;
        setRevisionId(rid);
        revisionIdRef.current = rid;
        setRevisionLocked(false);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Не удалось загрузить место");
      setFormData(null);
      setOriginalFormData(null);
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    void loadPlace();
  }, [loadPlace]);

  const flushSave = useCallback(async () => {
    const current = formDataRef.current;
    const orig = originalRef.current;
    if (!current || !orig || revisionLocked) return;

    const changes = extractChanges(current, orig);
    const contactChanges = pickContactChanges(changes);
    if (Object.keys(contactChanges).length === 0) return;

    setSaving(true);
    try {
      if (placeStatus === "PUBLISHED") {
        const revRes = await fetch(`/api/business/places/${placeId}/revision`, {
          credentials: "include",
        });
        if (!revRes.ok) {
          const err = await revRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Не удалось получить ревизию места");
        }
        const revJson = (await revRes.json()) as { revision?: ActiveRevisionLite };
        const rid = revJson.revision?.id ?? null;
        if (!rid) {
          throw new Error("Нет ревизии для опубликованного места");
        }
        revisionIdRef.current = rid;
        setRevisionId(rid);
        if (revJson.revision?.status === "PENDING") {
          toast.message("Редактирование недоступно: ревизия на модерации.");
          return;
        }

        const patchRes = await fetch(`/api/business/places/${placeId}/revision`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionId: rid, data: contactChanges }),
        });
        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Не удалось сохранить ревизию");
        }
      } else {
        const patchRes = await fetch(`/api/business/places/${placeId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactChanges),
        });
        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({}));
          const msg =
            (err as { message?: string }).message ||
            (err as { error?: string }).error ||
            "Не удалось сохранить";
          if (
            patchRes.status === 400 &&
            String(msg).includes("PUBLISHED_PLACE_REQUIRES_REVISION")
          ) {
            toast.error("Опубликованное место нужно редактировать через ревизию. Обновите страницу.");
            return;
          }
          throw new Error(msg);
        }
      }

      setOriginalFormData({ ...current });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения контактов");
    } finally {
      setSaving(false);
    }
  }, [placeId, placeStatus, revisionLocked]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void flushSave();
    }, CONTACT_DEBOUNCE_MS);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [placeId]);

  const onChange = useCallback(
    (updates: Partial<PlaceFormData>) => {
      if (revisionLocked) return;
      setFormData((prev) => (prev ? { ...prev, ...updates } : prev));
      scheduleSave();
    },
    [revisionLocked, scheduleSave],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Загрузка контактов места…
      </div>
    );
  }

  if (loadError || !formData) {
    return <p className="text-sm text-destructive">{loadError ?? "Место не найдено"}</p>;
  }

  const editable = !revisionLocked;

  return (
    <div className="space-y-8">
      {revisionLocked ? (
        <p className="text-sm text-muted-foreground rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2">
          Ревизия места на модерации — контакты и соцсети сейчас только для просмотра.
        </p>
      ) : null}
      {saving ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Сохранение…
        </p>
      ) : null}

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Контакты</h3>
          <p className="text-sm text-muted-foreground">Как с вами связаться</p>
        </div>
        <div className="space-y-6 pt-1">
          <PlacePhoneWebsiteFields data={formData} onChange={onChange} isEditable={editable} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Соцсети</h3>
        <div className="space-y-6 pt-1">
          <PlaceInstagramField data={formData} onChange={onChange} isEditable={editable} />
        </div>
      </div>
    </div>
  );
}
