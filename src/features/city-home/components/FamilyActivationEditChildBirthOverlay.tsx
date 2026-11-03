"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChildBirthFields, childBirthDraftPayload, emptyChildBirthDraft } from "@/components/children/ChildBirthFields";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { notifyFamilyPersonasChanged } from "@/lib/family/familyPersonaEvents";

/**
 * Narrow update for children whose birth date is missing. Deliberately sends
 * only birth fields: previously saved interests/name are never overwritten.
 */
export function FamilyActivationEditChildBirthOverlay({
  child,
  open,
  onOpenChange,
  onSuccess,
}: {
  child: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(emptyChildBirthDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyChildBirthDraft());
    setError(null);
  }, [open, child?.id]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = childBirthDraftPayload(draft);
    if (!child || !payload) {
      setError("Укажите дату или месяц и год рождения.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/children/" + encodeURIComponent(child.id), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "Не удалось сохранить.");
      }
      onOpenChange(false);
      notifyFamilyPersonasChanged();
      router.refresh();
      await onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md">
        <DialogTitle>Возраст ребёнка{child?.name ? ": " + child.name : ""}</DialogTitle>
        <DialogDescription>
          Укажите дату рождения — покажем мероприятия по возрасту. Интересы и остальные данные не изменятся.
        </DialogDescription>
        <form className="space-y-4" onSubmit={(event) => void save(event)}>
          <ChildBirthFields value={draft} onChange={setDraft} idPrefix="home-child-birth" />
          {draft.precision === "DAY" && (
            <button type="button" className="text-sm underline" onClick={() => setDraft({ precision: "MONTH", month: "", year: "" })}>
              Указать только месяц и год
            </button>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Отмена</Button>
            <Button type="submit" disabled={saving || !childBirthDraftPayload(draft)}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
