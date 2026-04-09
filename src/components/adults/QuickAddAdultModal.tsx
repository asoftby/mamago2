"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { notifyFamilyPersonasChanged } from "@/lib/family/familyPersonaEvents";

export interface QuickAddAdultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (adultId: string) => void;
}

export function QuickAddAdultModal({
  open,
  onOpenChange,
  onSuccess,
}: QuickAddAdultModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const canSave = name.trim().length >= 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      setError("Укажите имя");
      return;
    }

    setIsLoading(true);
    setError(null);
    const body = {
      displayName: name.trim(),
      preferences: [],
    };

    try {
      const res = await fetch("/api/adults", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Не удалось сохранить");
      }
      const adultId = data?.adult?.id;
      onOpenChange(false);
      onSuccess?.(adultId);
      notifyFamilyPersonasChanged();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,400px)] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:w-full",
          "max-sm:fixed max-sm:bottom-4 max-sm:left-1/2 max-sm:top-auto max-sm:translate-x-[-50%] max-sm:translate-y-0",
        )}
      >
        <DialogTitle className="sr-only">Добавить взрослого</DialogTitle>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center border-b border-neutral-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-neutral-900">Добавить взрослого</h2>
              <p className="text-sm text-neutral-500 mt-0.5">
                Настроим предпочтения
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quick-adult-name">Имя</Label>
                <Input
                  id="quick-adult-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Как зовут"
                  className="h-11"
                  autoComplete="name"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-neutral-100 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="h-11 flex-1"
                disabled={!canSave || isLoading}
              >
                {isLoading ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
