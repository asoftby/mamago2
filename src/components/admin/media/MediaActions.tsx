"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2, RefreshCw } from "lucide-react";
import type { MediaAssetStatus } from "@prisma/client";

interface MediaActionsProps {
  mediaId: string;
  status: MediaAssetStatus;
  usageCount: number;
}

export function MediaActions({ mediaId, status, usageCount }: MediaActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    if (!confirm("Архивировать этот файл? Он будет скрыт из основного списка, но останется доступным через фильтр.")) {
      return;
    }

    setIsArchiving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/media/${mediaId}/archive`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка архивирования");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка архивирования");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/media/${mediaId}/restore`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка восстановления");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка восстановления");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Вы уверены, что хотите удалить этот файл? Это действие нельзя отменить.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/media/${mediaId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка удаления");
      }

      router.push("/admin/media");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-4">
      <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Действия</h2>
      <div className="space-y-2">
        {status === "ACTIVE" && (
          <button
            onClick={handleArchive}
            disabled={isArchiving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            {isArchiving ? "Архивирование..." : "Архивировать"}
          </button>
        )}
        {status === "ARCHIVED" && (
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {isRestoring ? "Восстановление..." : "Восстановить"}
          </button>
        )}
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" />
          Пересчитать usage
        </button>
        {usageCount === 0 && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Удаление..." : "Удалить навсегда"}
          </button>
        )}
        {usageCount > 0 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs text-orange-800">
              Удаление заблокировано: файл используется в {usageCount} местах
            </p>
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
