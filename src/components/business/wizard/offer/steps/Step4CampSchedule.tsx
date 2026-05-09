// Step 4: Camp Schedule (CAMP type only)
// Defines camp sessions, duration, and schedule details

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { OfferFormData } from "../types";

interface Step4CampScheduleProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step4CampSchedule({ data, onChange, isEditable }: Step4CampScheduleProps) {
  const handleAddSession = () => {
    const newSession = {
      dateFrom: null,
      dateTo: null,
    };
    onChange({
      campSessions: [...data.campSessions, newSession],
    });
  };

  const handleUpdateSession = (index: number, field: "dateFrom" | "dateTo", value: string | null) => {
    const updatedSessions = [...data.campSessions];
    updatedSessions[index] = {
      ...updatedSessions[index],
      [field]: value,
    };
    onChange({ campSessions: updatedSessions });
  };

  const handleRemoveSession = (index: number) => {
    const filteredSessions = data.campSessions.filter((_, i) => i !== index);
    onChange({ campSessions: filteredSessions });
  };

  const handleSessionDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ campSessionDuration: e.target.value });
  };

  const handleStayDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ campStayDuration: e.target.value });
  };

  const handlePlacesCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    onChange({ campPlacesCount: value });
  };

  const handleGroupSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    onChange({ campGroupSize: value });
  };

  const handleDayScheduleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ campDaySchedule: e.target.value });
  };

  const handleCanSelectDaysChange = () => {
    onChange({ campCanSelectDays: !data.campCanSelectDays });
  };

  const handleHasExtendedCareChange = () => {
    onChange({ campHasExtendedCare: !data.campHasExtendedCare });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Смены и расписание</h2>
        <p className="text-muted-foreground">
          Укажите даты, формат пребывания и расписание смены
        </p>
      </div>

      {/* Camp Sessions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Смены</Label>
            <p className="text-xs text-muted-foreground mt-1">Укажите даты начала и окончания каждой смены</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSession}
            disabled={!isEditable}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить смену
          </Button>
        </div>

        {data.campSessions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <p>Добавьте хотя бы одну смену</p>
          </div>
        )}

        <div className="space-y-3">
          {data.campSessions.map((session, index) => (
            <Card key={index} className="border-2">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <h4 className="font-medium">Смена {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSession(index)}
                    disabled={!isEditable}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`dateFrom-${index}`}>Дата начала</Label>
                    <Input
                      id={`dateFrom-${index}`}
                      type="date"
                      value={session.dateFrom || ""}
                      onChange={(e) => handleUpdateSession(index, "dateFrom", e.target.value || null)}
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`dateTo-${index}`}>Дата окончания</Label>
                    <Input
                      id={`dateTo-${index}`}
                      type="date"
                      value={session.dateTo || ""}
                      onChange={(e) => handleUpdateSession(index, "dateTo", e.target.value || null)}
                      disabled={!isEditable}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Session Duration */}
      <div className="space-y-2">
        <Label htmlFor="campSessionDuration">
          Длительность смены <span className="text-red-500">*</span>
        </Label>
        <Input
          id="campSessionDuration"
          placeholder="Например: 7 дней, 2 недели, 10 дней"
          value={data.campSessionDuration}
          onChange={handleSessionDurationChange}
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground">
          Укажите продолжительность одной смены
        </p>
      </div>

      {/* Stay Duration */}
      <div className="space-y-2">
        <Label htmlFor="campStayDuration">
          Время пребывания <span className="text-red-500">*</span>
        </Label>
        <Input
          id="campStayDuration"
          placeholder="Например: с 9:00 до 17:00, круглосуточно, с 10:00 до 18:00"
          value={data.campStayDuration}
          onChange={handleStayDurationChange}
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground">
          Укажите часы работы лагеря или формат пребывания
        </p>
      </div>

      {/* Capacity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="campPlacesCount">Количество мест</Label>
          <Input
            id="campPlacesCount"
            type="number"
            placeholder="Например: 30"
            value={data.campPlacesCount || ""}
            onChange={handlePlacesCountChange}
            disabled={!isEditable}
            min="1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campGroupSize">Размер группы</Label>
          <Input
            id="campGroupSize"
            type="number"
            placeholder="Например: 10"
            value={data.campGroupSize || ""}
            onChange={handleGroupSizeChange}
            disabled={!isEditable}
            min="1"
          />
        </div>
      </div>

      {/* Day Schedule */}
      <div className="space-y-2">
        <Label htmlFor="campDaySchedule">
          Расписание дня <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="campDaySchedule"
          placeholder="Опишите примерное расписание дня: завтрак, занятия, обед, свободное время, ужин..."
          value={data.campDaySchedule}
          onChange={handleDayScheduleChange}
          disabled={!isEditable}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Расскажите о распорядке дня в лагере
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3 bg-gray-50 border rounded-lg p-4">
        <h3 className="font-medium">Дополнительные опции</h3>
        
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.campCanSelectDays}
            onChange={handleCanSelectDaysChange}
            disabled={!isEditable}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm">Можно выбрать отдельные дни</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.campHasExtendedCare}
            onChange={handleHasExtendedCareChange}
            disabled={!isEditable}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm">Есть опция продлённого дня</span>
        </label>
      </div>
    </div>
  );
}
