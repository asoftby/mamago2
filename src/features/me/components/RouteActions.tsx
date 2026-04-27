"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit2, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

interface RouteActionsProps {
  routeId: string;
  routeSlug: string;
  routeTitle: string;
}

export function RouteActions({ routeId, routeSlug, routeTitle }: RouteActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;

    if (!confirm(`Удалить маршрут "${routeTitle}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/routes/${routeId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Маршрут удалён");
        router.refresh();
      } else {
        const error = await res.json().catch(() => ({ error: "Ошибка при удалении" }));
        toast.error(error.error || "Ошибка при удалении маршрута");
      }
    } catch (err) {
      toast.error("Ошибка при удалении маршрута");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <Link
        href={`/routes/${routeSlug}/edit`}
        className="p-2 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
        title="Редактировать"
      >
        <Edit2 className="w-4 h-4" />
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        title="Удалить"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
