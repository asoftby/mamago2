"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { Trash2, AlertTriangle } from "lucide-react";

interface PlaceDangerZoneProps {
  placeId: string;
  placeTitle: string;
  canDelete?: boolean;
}

export function PlaceDangerZone({
  placeId,
  placeTitle,
  canDelete = true,
}: PlaceDangerZoneProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!canDelete) {
    return null;
  }

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Введите DELETE для подтверждения");
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/places/${placeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete place");
      }

      toast.success("Место успешно удалено");
      
      // Redirect to moderation queue
      router.push("/admin/moderation/queue");
      router.refresh();
    } catch (error: unknown) {
      console.error("Delete place error:", error);
      toast.error(error instanceof Error ? error.message : "Не удалось удалить место");
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white border border-red-200 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-md font-semibold text-red-900 mb-2">
            Danger Zone
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Удаление места необратимо. Все связанные данные (изображения, ревизии, запросы на доработку) будут удалены.
          </p>

          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Удалить место
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Это действие необратимо. Место <strong>{placeTitle}</strong> и все связанные данные будут удалены:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Все изображения места</li>
                    <li>Все ревизии (черновики и история)</li>
                    <li>Все запросы на доработку</li>
                    <li>История модерации</li>
                    <li>Связи с активностями</li>
                  </ul>
                  <div className="pt-2">
                    <Label htmlFor="confirm-delete" className="text-sm font-medium">
                      Введите <span className="font-mono font-bold">DELETE</span> для подтверждения:
                    </Label>
                    <Input
                      id="confirm-delete"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="mt-2"
                      autoComplete="off"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>
                  Отмена
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={confirmText !== "DELETE" || isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? "Удаление..." : "Удалить навсегда"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
