"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateUrgency, SEVERITY_CONFIG, type SeverityLevel } from "@/lib/improvementRequest/urgency";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface ImprovementRequest {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  severity: string;
  title: string;
  description: string;
  dueAt: string | null;
  createdAt: string;
}

interface ImprovementRequestWithPlace extends ImprovementRequest {
  place?: {
    id: string;
    title: string;
  };
}

export function ImprovementRequestsWidget() {
  const [requests, setRequests] = useState<ImprovementRequestWithPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await fetch("/api/business/improvement-requests");
        if (response.ok) {
          const data = await response.json();
          
          // Fetch place details for each request
          const requestsWithPlaces = await Promise.all(
            data.requests.map(async (request: ImprovementRequest) => {
              if (request.entityType === "PLACE") {
                try {
                  const placeResponse = await fetch(`/api/business/places/${request.entityId}`);
                  if (placeResponse.ok) {
                    const placeData = await placeResponse.json();
                    return {
                      ...request,
                      place: {
                        id: placeData.place.id,
                        title: placeData.place.title,
                      },
                    };
                  }
                } catch (error) {
                  console.error("Failed to fetch place:", error);
                }
              }
              return request;
            })
          );
          
          setRequests(requestsWithPlaces);
        }
      } catch (error) {
        console.error("Failed to fetch improvement requests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Требуют внимания
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Загрузка...</p>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null; // Don't show widget if no active requests
  }

  // Calculate urgency stats
  const overdueCount = requests.filter(r => {
    const urgency = calculateUrgency(r.dueAt);
    return urgency?.level === "overdue";
  }).length;

  const dueSoonCount = requests.filter(r => {
    const urgency = calculateUrgency(r.dueAt);
    return urgency?.level === "due_soon" && urgency.urgent;
  }).length;

  // Show top 3 most urgent requests
  const topRequests = [...requests]
    .sort((a, b) => {
      // Sort by urgency first
      const urgencyA = calculateUrgency(a.dueAt);
      const urgencyB = calculateUrgency(b.dueAt);
      
      if (urgencyA?.level === "overdue" && urgencyB?.level !== "overdue") return -1;
      if (urgencyA?.level !== "overdue" && urgencyB?.level === "overdue") return 1;
      if (urgencyA?.urgent && !urgencyB?.urgent) return -1;
      if (!urgencyA?.urgent && urgencyB?.urgent) return 1;
      
      // Then by severity
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const severityA = severityOrder[a.severity as keyof typeof severityOrder] ?? 4;
      const severityB = severityOrder[b.severity as keyof typeof severityOrder] ?? 4;
      
      return severityA - severityB;
    })
    .slice(0, 3);

  // Generate dynamic summary text
  const getSummaryText = () => {
    const placeWord = requests.length === 1 
      ? "место требует" 
      : requests.length < 5 
      ? "места требуют" 
      : "мест требуют";
    
    const requestWord = (count: number) => {
      if (count === 1) return "запрос";
      if (count < 5) return "запроса";
      return "запросов";
    };

    if (overdueCount > 0) {
      const overdueWord = requestWord(overdueCount);
      if (overdueCount === requests.length) {
        return `${requests.length} ${placeWord} исправлений. Все ${overdueCount} ${overdueWord} уже просрочены.`;
      }
      return `${requests.length} ${placeWord} исправлений. ${overdueCount} из ${requests.length} ${overdueWord} уже просрочены.`;
    }

    if (dueSoonCount > 0) {
      const urgentWord = requestWord(dueSoonCount);
      if (dueSoonCount === 1) {
        return `${requests.length} ${placeWord} исправлений. ${dueSoonCount} ${urgentWord} требует срочного обновления.`;
      }
      return `${requests.length} ${placeWord} исправлений. ${dueSoonCount} ${urgentWord} требуют срочного обновления.`;
    }

    return `${requests.length} ${placeWord} исправлений.`;
  };

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-amber-900">Требуют внимания</span>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="bg-red-600">
                {overdueCount} просрочено
              </Badge>
            )}
            {dueSoonCount > 0 && (
              <Badge variant="outline" className="border-orange-500 text-orange-700">
                {dueSoonCount} срочно
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quantitative Summary */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-amber-900">
            {getSummaryText()}
          </p>
          
          {/* System Consequence */}
          <div className="flex items-start gap-2 p-3 bg-white/60 rounded-lg border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Если информация о местах остается неактуальной, система может понизить видимость связанных предложений в рейтинге до момента внесения исправлений.
            </p>
          </div>
        </div>

        {/* Top requests list */}
        <div className="space-y-3">
          {topRequests.map((request) => {
            const urgency = calculateUrgency(request.dueAt);
            const severityConfig = SEVERITY_CONFIG[request.severity as SeverityLevel] || {
              label: request.severity,
              color: "bg-gray-100 text-gray-800",
              icon: "⚪"
            };

            return (
              <div
                key={request.id}
                className="bg-white rounded-lg p-4 border border-amber-200 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{severityConfig.icon}</span>
                      <h4 className="font-medium text-gray-900 truncate">
                        {request.place?.title || "Место"}
                      </h4>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                      {request.title}
                    </p>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={severityConfig.color}>
                        {severityConfig.label}
                      </Badge>
                      
                      {urgency && (
                        <Badge 
                          variant="outline" 
                          className={`${urgency.color} ${urgency.urgent ? "font-semibold" : ""}`}
                        >
                          {urgency.label}
                        </Badge>
                      )}
                      
                      {request.dueAt && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(request.dueAt).toLocaleDateString("ru-RU")}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    asChild
                    size="sm"
                    variant={urgency?.urgent ? "default" : "outline"}
                    className={urgency?.urgent ? "bg-amber-600 hover:bg-amber-700" : ""}
                  >
                    <Link href={`/business/places/${request.entityId}/edit`}>
                      Исправить
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* View all link if more than 3 */}
        {requests.length > 3 && (
          <div className="pt-2 border-t border-amber-200">
            <Link
              href="/business/places?filter=needs-attention"
              className="text-sm text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
            >
              Показать все ({requests.length})
              <span>→</span>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
