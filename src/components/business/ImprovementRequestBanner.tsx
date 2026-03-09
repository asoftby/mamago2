"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ImprovementRequest {
  id: string;
  entityType: string;
  entityId: string;
  severity: string;
  title: string;
  description: string;
  dueAt: string | null;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Низкая",
  MEDIUM: "Средняя",
  HIGH: "Высокая",
  CRITICAL: "Критическая",
};

export function ImprovementRequestBanner() {
  const [requests, setRequests] = useState<ImprovementRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await fetch("/api/business/improvement-requests");
        if (response.ok) {
          const data = await response.json();
          setRequests(data.requests || []);
        }
      } catch (error) {
        console.error("Failed to fetch improvement requests:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, []);

  if (isLoading || requests.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 mb-2">
            Требуется доработка контента
          </h3>
          <p className="text-sm text-amber-800 mb-3">
            У вас есть {requests.length} активных запросов на улучшение от модераторов.
          </p>
          
          <div className="space-y-2 mb-3">
            {requests.slice(0, 3).map((request) => (
              <div key={request.id} className="bg-white rounded p-3 border border-amber-200">
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900">
                    {request.title}
                  </span>
                  <Badge className={SEVERITY_COLORS[request.severity] || "bg-gray-100 text-gray-800"}>
                    {SEVERITY_LABELS[request.severity] || request.severity}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {request.description}
                </p>
                {request.dueAt && (
                  <p className="text-xs text-amber-700 mt-1">
                    Срок: {new Date(request.dueAt).toLocaleDateString("ru-RU")}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Link href="/business/improvement-requests">
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100">
              Посмотреть все запросы
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
