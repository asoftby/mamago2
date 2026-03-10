"use client";

import { AlertTriangle, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";

interface ImprovementRequest {
  id: string;
  status: string;
  severity: string;
  title: string;
  description: string;
  dueAt: string | null;
  createdAt: string;
  createdByModerator: {
    id: string;
    email: string;
    role: string;
  };
}

interface ImprovementRequestEditBannerProps {
  requests: ImprovementRequest[];
}

const SEVERITY_CONFIG = {
  LOW: { label: "Низкая", color: "bg-blue-100 text-blue-800", icon: "🔵" },
  MEDIUM: { label: "Средняя", color: "bg-yellow-100 text-yellow-800", icon: "🟡" },
  HIGH: { label: "Высокая", color: "bg-orange-100 text-orange-800", icon: "🟠" },
  CRITICAL: { label: "Критическая", color: "bg-red-100 text-red-800", icon: "🔴" },
};

function getUrgencyStatus(dueAt: string | null) {
  if (!dueAt) return null;
  
  const due = new Date(dueAt);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { label: "Просрочено", color: "text-red-600", urgent: true };
  if (diffDays <= 2) return { label: "Срочно", color: "text-orange-600", urgent: true };
  if (diffDays <= 7) return { label: "Скоро", color: "text-yellow-600", urgent: false };
  return null;
}

export function ImprovementRequestEditBanner({ requests }: ImprovementRequestEditBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (requests.length === 0) {
    return null;
  }

  const activeRequests = requests.filter(req => req.status === "OPEN" || req.status === "IN_PROGRESS");
  
  if (activeRequests.length === 0) {
    return null;
  }

  const primaryRequest = activeRequests[0];
  const severityConfig = SEVERITY_CONFIG[primaryRequest.severity as keyof typeof SEVERITY_CONFIG] || {
    label: primaryRequest.severity,
    color: "bg-gray-100 text-gray-800",
    icon: "⚪"
  };

  const urgency = getUrgencyStatus(primaryRequest.dueAt);

  // Show details in collapsed state only if there's a single request
  const showDetailsWhenCollapsed = activeRequests.length === 1;

  return (
    <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 mb-6">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-amber-100/50 transition-colors">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-amber-900">
                    {activeRequests.length === 1 
                      ? "Запрос на доработку от модератора"
                      : `${activeRequests.length} запросов на доработку от модераторов`
                    }
                  </h3>
                  {showDetailsWhenCollapsed && (
                    <div className="flex items-center gap-2">
                      {urgency && (
                        <Badge variant="outline" className={urgency.color}>
                          {urgency.label}
                        </Badge>
                      )}
                      <Badge className={severityConfig.color}>
                        {severityConfig.label}
                      </Badge>
                    </div>
                  )}
                </div>
                
                {showDetailsWhenCollapsed && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{severityConfig.icon}</span>
                      <span className="font-medium text-amber-900">{primaryRequest.title}</span>
                    </div>
                    
                    <p className="text-sm text-amber-800 line-clamp-2">
                      {primaryRequest.description}
                    </p>
                    
                    <div className="flex items-center justify-between mt-2 text-xs text-amber-700">
                      <span>
                        Создан {formatDistanceToNow(new Date(primaryRequest.createdAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </span>
                      {primaryRequest.dueAt && (
                        <span className={urgency?.urgent ? "font-medium" : ""}>
                          Срок: {new Date(primaryRequest.dueAt).toLocaleDateString("ru-RU")}
                        </span>
                      )}
                    </div>
                  </>
                )}
                
                <div className={`text-xs text-amber-600 ${showDetailsWhenCollapsed ? 'mt-1' : ''}`}>
                  {isExpanded ? "Свернуть детали" : "Нажмите для просмотра деталей"}
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-amber-200">
            <div className="mt-4 space-y-4">
              {activeRequests.map((request, index) => {
                const reqSeverityConfig = SEVERITY_CONFIG[request.severity as keyof typeof SEVERITY_CONFIG] || {
                  label: request.severity,
                  color: "bg-gray-100 text-gray-800",
                  icon: "⚪"
                };
                
                const reqUrgency = getUrgencyStatus(request.dueAt);

                return (
                  <div key={request.id} className="bg-white rounded-lg p-4 border border-amber-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{reqSeverityConfig.icon}</span>
                        <div>
                          <h4 className="font-medium text-gray-900">{request.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={reqSeverityConfig.color}>
                              {reqSeverityConfig.label}
                            </Badge>
                            {reqUrgency && (
                              <Badge variant="outline" className={reqUrgency.color}>
                                {reqUrgency.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right text-sm text-gray-500">
                        <div>
                          {formatDistanceToNow(new Date(request.createdAt), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </div>
                        {request.dueAt && (
                          <div className={reqUrgency?.urgent ? "font-medium text-red-600" : ""}>
                            До: {new Date(request.dueAt).toLocaleDateString("ru-RU")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {request.description}
                      </p>
                    </div>

                    <div className="text-sm text-gray-500">
                      Модератор: {request.createdByModerator.email}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}