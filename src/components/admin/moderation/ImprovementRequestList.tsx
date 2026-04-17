"use client";

import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

export interface ImprovementRequest {
  id: string;
  status: string;
  severity: string;
  title: string;
  description: string;
  dueAt: Date | string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  createdByModerator: {
    email: string;
  };
}

interface ImprovementRequestListProps {
  requests: ImprovementRequest[];
  onUpdate?: () => void;
}

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  LOW: { label: "Низкая", color: "bg-blue-100 text-blue-800" },
  MEDIUM: { label: "Средняя", color: "bg-yellow-100 text-yellow-800" },
  HIGH: { label: "Высокая", color: "bg-orange-100 text-orange-800" },
  CRITICAL: { label: "Критическая", color: "bg-red-100 text-red-800" },
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  RESOLVED: "Решён",
  CANCELLED: "Отменён",
};

export function ImprovementRequestList({
  requests,
  onUpdate,
}: ImprovementRequestListProps) {
  const [actioningId, setActioningId] = useState<string | null>(null);

  const handleAction = async (requestId: string, action: "resolve" | "cancel") => {
    setActioningId(requestId);

    try {
      const response = await fetch(`/api/admin/places/improvement-request`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update request");
      }

      toast.success(action === "resolve" ? "Запрос решён" : "Запрос отменён");

      if (onUpdate) {
        onUpdate();
      }
    } catch (error: unknown) {
      console.error("Update improvement request error:", error);
      toast.error(error instanceof Error ? error.message : "Не удалось обновить запрос");
    } finally {
      setActioningId(null);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        Запросов на доработку нет
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const severityInfo = SEVERITY_LABELS[request.severity] || {
          label: request.severity,
          color: "bg-gray-100 text-gray-800",
        };

        return (
          <div key={request.id} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge className={severityInfo.color}>
                  {severityInfo.label}
                </Badge>
                <Badge variant="outline">
                  {STATUS_LABELS[request.status] || request.status}
                </Badge>
              </div>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(request.createdAt), {
                  addSuffix: true,
                  locale: ru,
                })}
              </span>
            </div>

            <h4 className="font-medium mb-2">{request.title}</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
              {request.description}
            </p>

            {request.dueAt && (
              <div className="text-xs text-gray-600 mb-2">
                Срок: {new Date(request.dueAt).toLocaleDateString("ru-RU")}
              </div>
            )}

            <div className="text-xs text-gray-500 mb-3">
              Создал: {request.createdByModerator.email}
            </div>

            {request.status === "OPEN" || request.status === "IN_PROGRESS" ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(request.id, "resolve")}
                  disabled={actioningId === request.id}
                >
                  Решить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAction(request.id, "cancel")}
                  disabled={actioningId === request.id}
                >
                  Отменить
                </Button>
              </div>
            ) : null}

            {request.resolvedAt && (
              <div className="text-xs text-green-600 mt-2">
                Решён: {new Date(request.resolvedAt).toLocaleDateString("ru-RU")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
