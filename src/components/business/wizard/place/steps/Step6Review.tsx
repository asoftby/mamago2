"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { validateStep1, validateStep2, validateStep3, validateStep4, validateStep5 } from "../validation";
import { sortAgeKeys } from "@/lib/config/ages";
import { getPlaceCompletion, getCompletionMessage, getCompletionColor } from "../completion";
import type { PlaceFormData } from "../types";

interface Step6ReviewProps {
  data: PlaceFormData;
  isSubmitting?: boolean;
}

export function Step6Review({ data, isSubmitting = false }: Step6ReviewProps) {
  const step1 = validateStep1(data);
  const step2 = validateStep2(data);
  const step3 = validateStep3(data);
  const step4 = validateStep4(data);
  const step5 = validateStep5(data);
  
  const completion = getPlaceCompletion(data);
  const completionMessage = getCompletionMessage(completion.percent);
  const completionColor = getCompletionColor(completion.percent);
  
  const allRequiredCompleted = step1.isComplete && step2.isComplete && step4.isComplete;

  const steps = [
    {
      number: 1,
      title: "Профиль",
      validation: step1,
      required: true,
    },
    {
      number: 2,
      title: "Локация",
      validation: step2,
      required: true,
    },
    {
      number: 3,
      title: "Контакты",
      validation: step3,
      required: false,
    },
    {
      number: 4,
      title: "Фото",
      validation: step4,
      required: true,
    },
    {
      number: 5,
      title: "Режим работы",
      validation: step5,
      required: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Проверка перед отправкой</h2>
        <p className="text-muted-foreground">
          Убедитесь, что все обязательные разделы заполнены
        </p>
      </div>

      {/* Overall status */}
      {allRequiredCompleted ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-green-900">Готово к отправке</h3>
            <p className="text-sm text-green-700 mt-1">
              Все обязательные разделы заполнены. Вы можете отправить место на модерацию.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-900">Требуется заполнение</h3>
            <p className="text-sm text-amber-700 mt-1">
              Заполните все обязательные разделы, чтобы отправить место на модерацию.
            </p>
          </div>
        </div>
      )}

      {/* Completion Score */}
      <Card>
        <CardHeader>
          <CardTitle>Полнота заполнения карточки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Заполнено</span>
              <span className={`text-2xl font-bold ${completionColor}`}>
                {completion.percent}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  completion.percent === 100 ? "bg-green-600" :
                  completion.percent >= 80 ? "bg-blue-600" :
                  completion.percent >= 50 ? "bg-amber-500" : "bg-gray-400"
                }`}
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {completionMessage}
            </p>
          </div>
          
          {completion.percent < 100 && completion.missingFields.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">
                Для улучшения карточки добавьте:
              </div>
              <ul className="space-y-1">
                {completion.missingFields.slice(0, 5).map((field) => (
                  <li key={field.field} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    {field.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Статус заполнения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {step.validation.isComplete ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-medium">
                    Шаг {step.number}: {step.title}
                  </span>
                </div>
                {step.required && (
                  <Badge variant="secondary" className="text-xs">
                    Обязательно
                  </Badge>
                )}
              </div>
              <div>
                {step.validation.isComplete ? (
                  <Badge variant="default" className="bg-green-600">
                    Заполнено
                  </Badge>
                ) : step.validation.errors.length > 0 ? (
                  <Badge variant="destructive">
                    Не заполнено
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    Необязательно
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Errors list */}
      {!allRequiredCompleted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Требуется исправить</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {steps.map((step) => 
                step.required && step.validation.errors.length > 0 ? (
                  <li key={step.number} className="text-sm">
                    <span className="font-medium">Шаг {step.number}:</span>
                    <ul className="ml-4 mt-1 space-y-1">
                      {step.validation.errors.map((error, idx) => (
                        <li key={idx} className="text-red-600">• {error}</li>
                      ))}
                    </ul>
                  </li>
                ) : null
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Place preview */}
      <Card>
        <CardHeader>
          <CardTitle>Предпросмотр</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {/* Logo in circle */}
            {(data.logoUrl || data.images.find(img => img.kind === "LOGO")) && (
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200">
                  <img 
                    src={data.logoUrl || data.images.find(img => img.kind === "LOGO")?.url || ""} 
                    alt="Логотип" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            
            {/* Title and description */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold">{data.title || "Без названия"}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {data.shortDesc || "Нет краткого описания"}
              </p>
              {data.category && (
                <p className="text-xs text-muted-foreground mt-1">
                  Категория: {data.category}
                </p>
              )}
            </div>
          </div>
          
          {/* Description */}
          {data.description && (
            <div className="text-sm">
              <div className="font-medium mb-1">Описание:</div>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {data.description.length > 200 
                  ? `${data.description.slice(0, 200)}...` 
                  : data.description}
              </p>
            </div>
          )}
          
          {/* Activity Types */}
          {data.activityTypes && data.activityTypes.length > 0 && (
            <div className="text-sm">
              <div className="font-medium mb-2">Типы активностей:</div>
              <div className="flex flex-wrap gap-2">
                {data.activityTypes.map((type, idx) => (
                  <span 
                    key={idx}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Age Tags */}
          {data.ageTags && data.ageTags.length > 0 && (
            <div className="text-sm">
              <div className="font-medium mb-2">Возраст:</div>
              <div className="flex flex-wrap gap-2">
                {sortAgeKeys(data.ageTags).map((tag, idx) => (
                  <span 
                    key={idx}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Visit Formats */}
          {data.visitFormats && data.visitFormats.length > 0 && (
            <div className="text-sm">
              <div className="font-medium mb-2">Формат посещения:</div>
              <div className="flex flex-wrap gap-2">
                {data.visitFormats.map((format, idx) => (
                  <span 
                    key={idx}
                    className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Photos */}
          {data.images.filter(img => img.kind === "GALLERY").length > 0 && (
            <div>
              <div className="font-medium text-sm mb-2">Фотографии:</div>
              <div className="flex gap-2 flex-wrap">
                {data.images.filter(img => img.kind === "GALLERY").slice(0, 6).map((img, idx) => (
                  <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img 
                      src={img.url} 
                      alt={`Фото ${idx + 1}`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {data.images.filter(img => img.kind === "GALLERY").length > 6 && (
                  <div className="w-20 h-20 rounded-lg border flex items-center justify-center bg-muted text-sm text-muted-foreground">
                    +{data.images.filter(img => img.kind === "GALLERY").length - 6}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {data.formattedAddr && (
            <div className="text-sm">
              <span className="font-medium">Адрес:</span> {data.formattedAddr}
            </div>
          )}
          
          {/* Opening Hours */}
          {data.openingHoursData && (
            <div className="text-sm">
              <div className="font-medium mb-1">Режим работы:</div>
              {data.openingHoursData.mode === "ALWAYS_OPEN" && (
                <div className="text-green-600">Открыто круглосуточно</div>
              )}
              {data.openingHoursData.mode === "BY_APPOINTMENT" && (
                <div className="text-blue-600">По записи</div>
              )}
              {data.openingHoursData.mode === "TEMPORARILY_CLOSED" && (
                <div className="text-red-600">Временно закрыто</div>
              )}
              {data.openingHoursData.mode === "WEEKLY" && data.openingHoursData.rules && (() => {
                const openRules = data.openingHoursData.rules.filter(
                  rule => rule.isOpen && rule.intervals && rule.intervals.length > 0
                );
                
                if (openRules.length === 0) {
                  return <div className="text-muted-foreground">Расписание не настроено</div>;
                }
                
                // Mapping for both number and string day formats
                const dayNamesMap: Record<string | number, string> = {
                  0: "пн", 1: "вт", 2: "ср", 3: "чт", 4: "пт", 5: "сб", 6: "вс",
                  "MON": "пн", "TUE": "вт", "WED": "ср", "THU": "чт", 
                  "FRI": "пт", "SAT": "сб", "SUN": "вс"
                };
                
                return (
                  <div className="space-y-0.5">
                    {openRules.map((rule, idx) => {
                      const dayName = dayNamesMap[rule.dayOfWeek] || `день ${rule.dayOfWeek}`;
                      const times = rule.intervals
                        .map(int => `${int.startTime}-${int.endTime}`)
                        .join(", ");
                      return (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{dayName}:</span> {times}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
          
          {(data.phone || data.website || data.instagramHandle) && (
            <div className="text-sm space-y-1">
              <div className="font-medium">Контакты:</div>
              {data.phone && <div>Телефон: {data.phone}</div>}
              {data.website && <div>Сайт: {data.website}</div>}
              {data.instagramHandle && <div>Instagram: @{data.instagramHandle}</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
