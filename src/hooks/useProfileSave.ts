"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyFamilyPersonasChanged } from "@/lib/family/familyPersonaEvents";

export interface ProfileSaveInput {
  displayName?: string;
  avatarFile?: File | null;
}

export interface ProfileSaveResult {
  displayName?: string | null;
  avatarUrl?: string | null;
}

export function useProfileSave() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const save = async (input: ProfileSaveInput): Promise<ProfileSaveResult | null> => {
    if (!input.displayName?.trim() && !input.avatarFile) return null;

    setSaving(true);
    try {
      let avatarUrl: string | undefined;

      if (input.avatarFile) {
        const form = new FormData();
        form.append("file", input.avatarFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Ошибка загрузки фото");
        }
        avatarUrl = (await uploadRes.json()).url;
      }

      const patch: Record<string, unknown> = {};
      if (input.displayName?.trim()) patch.displayName = input.displayName.trim();
      if (avatarUrl !== undefined)    patch.avatarUrl   = avatarUrl;

      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Ошибка сохранения");
      }

      const updated: ProfileSaveResult = await res.json();
      toast.success("Профиль обновлён");
      notifyFamilyPersonasChanged();
      router.refresh();
      return updated;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
      return null;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Remove avatar: set avatarUrl = null in DB.
   * File cleanup happens server-side via PATCH /api/auth/me.
   */
  const removeAvatar = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) throw new Error("Ошибка удаления фото");
      toast.success("Фото удалено");
      router.refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить фото");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { save, removeAvatar, saving };
}
