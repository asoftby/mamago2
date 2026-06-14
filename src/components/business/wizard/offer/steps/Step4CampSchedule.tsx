// Step 4: Смены и расписание (CAMP)

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardRichTextField } from "@/components/business/wizard/shared/WizardRichTextField";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CalendarRange, ChevronDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampSessionEntry, CampSessionKind, OfferFormData } from "../types";
import {
  CAMP_SESSION_KIND_LABELS,
  createEmptyCampSession,
  formatCampShiftDateRangeRu,
} from "../campOfferModel";

interface Step4CampScheduleProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step4CampSchedule({ data, onChange, isEditable }: Step4CampScheduleProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const patchSession = (id: string, patch: Partial<CampSessionEntry>) => {
    onChange({
      campSessions: data.campSessions.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });
  };

  const handleAddSession = () => {
    const next = createEmptyCampSession(data.campSessions.length);
    onChange({
      campSessions: [...data.campSessions, next],
    });
  };

  const handleRemoveSession = (id: string) => {
    onChange({
      campSessions: data.campSessions.filter((s) => s.id !== id),
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Смены лагеря
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Добавьте даты смен, время и количество мест
        </p>
      </div>

      {data.campSessions.length === 0 ? (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-border/80 bg-muted/30 px-6 py-14 text-center",
            "transition-colors",
          )}
        >
          <CalendarRange className="mx-auto h-10 w-10 text-muted-foreground/70 mb-4" />
          <p className="text-sm font-medium text-foreground mb-1">
            Пока нет ни одной смены
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Родителям проще доверять программе, когда видны конкретные даты, возраст и
            вместимость каждой смены.
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto min-w-[220px] rounded-xl"
            onClick={handleAddSession}
            disabled={!isEditable}
          >
            <Plus className="mr-2 h-5 w-5" />
            Добавить смену
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data.campSessions.map((session) => {
              const rangeLabel = formatCampShiftDateRangeRu(session.dateFrom, session.dateTo);
              return (
                <Card
                  key={session.id}
                  data-session-id={session.id}
                  className="overflow-hidden rounded-2xl border border-border/70 shadow-sm"
                >
                  <CardContent className="p-4 sm:p-5 space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Смена
                        </p>
                        {rangeLabel ? (
                          <p className="text-base font-semibold text-foreground">{rangeLabel}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Укажите даты смены</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 self-start text-destructive hover:text-destructive"
                        onClick={() => handleRemoveSession(session.id)}
                        disabled={!isEditable}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Удалить
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`title-${session.id}`}>Название смены</Label>
                      <Input
                        id={`title-${session.id}`}
                        placeholder="Например: English Camp — Июнь"
                        value={session.title}
                        onChange={(e) => patchSession(session.id, { title: e.target.value })}
                        disabled={!isEditable}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`df-${session.id}`}>Дата начала</Label>
                        <Input
                          id={`df-${session.id}`}
                          type="date"
                          value={session.dateFrom ?? ""}
                          onChange={(e) =>
                            patchSession(session.id, {
                              dateFrom: e.target.value || null,
                            })
                          }
                          disabled={!isEditable}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`dt-${session.id}`}>Дата окончания</Label>
                        <Input
                          id={`dt-${session.id}`}
                          type="date"
                          value={session.dateTo ?? ""}
                          onChange={(e) =>
                            patchSession(session.id, {
                              dateTo: e.target.value || null,
                            })
                          }
                          disabled={!isEditable}
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`tf-${session.id}`}>Время начала</Label>
                        <Input
                          id={`tf-${session.id}`}
                          type="time"
                          value={session.timeFrom ?? ""}
                          onChange={(e) =>
                            patchSession(session.id, {
                              timeFrom: e.target.value || null,
                            })
                          }
                          disabled={!isEditable}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tt-${session.id}`}>Время окончания</Label>
                        <Input
                          id={`tt-${session.id}`}
                          type="time"
                          value={session.timeTo ?? ""}
                          onChange={(e) =>
                            patchSession(session.id, {
                              timeTo: e.target.value || null,
                            })
                          }
                          disabled={!isEditable}
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Тип</Label>
                      <Select
                        value={session.sessionKind}
                        onValueChange={(v) =>
                          patchSession(session.id, { sessionKind: v as CampSessionKind })
                        }
                        disabled={!isEditable}
                      >
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(CAMP_SESSION_KIND_LABELS) as CampSessionKind[]).map(
                            (k) => (
                              <SelectItem key={k} value={k}>
                                {CAMP_SESSION_KIND_LABELS[k]}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`agef-${session.id}`}>Возраст, от (лет)</Label>
                        <Input
                          id={`agef-${session.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={25}
                          placeholder="Например: 7"
                          value={session.ageFrom ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = parseInt(v, 10);
                            patchSession(session.id, {
                              ageFrom: v === "" ? null : Number.isFinite(n) ? n : session.ageFrom,
                            });
                          }}
                          disabled={!isEditable}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`aget-${session.id}`}>Возраст, до (лет)</Label>
                        <Input
                          id={`aget-${session.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={25}
                          placeholder="Например: 12"
                          value={session.ageTo ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = parseInt(v, 10);
                            patchSession(session.id, {
                              ageTo: v === "" ? null : Number.isFinite(n) ? n : session.ageTo,
                            });
                          }}
                          disabled={!isEditable}
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`cap-${session.id}`}>Вместимость (мест)</Label>
                        <Input
                          id={`cap-${session.id}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          placeholder="Например: 24"
                          value={session.capacity ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = parseInt(v, 10);
                            patchSession(session.id, {
                              capacity: v === "" ? null : Number.isFinite(n) ? n : session.capacity,
                            });
                          }}
                          disabled={!isEditable}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`left-${session.id}`}>Осталось мест (необязательно)</Label>
                        <Input
                          id={`left-${session.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="Например: 6"
                          value={session.spotsLeft ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = parseInt(v, 10);
                            patchSession(session.id, {
                              spotsLeft: v === "" ? null : Number.isFinite(n) ? n : session.spotsLeft,
                            });
                          }}
                          disabled={!isEditable}
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`price-${session.id}`}>
                        Цена смены (необязательно)
                      </Label>
                      <Input
                        id={`price-${session.id}`}
                        placeholder="Например: 850"
                        value={session.priceOverride}
                        onChange={(e) =>
                          patchSession(session.id, { priceOverride: e.target.value })
                        }
                        disabled={!isEditable}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <WizardRichTextField
                        label="Краткое описание смены"
                        helperText="Чем эта смена отличается от других: тема, акценты, интенсивность."
                        value={session.description}
                        onChange={(value) => patchSession(session.id, { description: value })}
                        placeholder="Чем эта смена отличается от других: язык, смена темы, интенсивность…"
                        disabled={!isEditable}
                        minHeight={140}
                      />
                    </div>

                    <div className="space-y-2">
                      <WizardRichTextField
                        label="Акционные данные"
                        helperText="Например: скидка за раннее бронирование, акция, бонусы, специальные условия для этой смены"
                        value={session.promotionDetails}
                        onChange={(value) =>
                          patchSession(session.id, { promotionDetails: value })
                        }
                        placeholder="Скидка за раннее бронирование, бонусы, специальные условия для этой смены…"
                        disabled={!isEditable}
                        minHeight={140}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full rounded-xl border-dashed"
            onClick={handleAddSession}
            disabled={!isEditable}
          >
            <Plus className="mr-2 h-5 w-5" />
            Добавить смену
          </Button>
        </>
      )}

      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-left text-sm font-medium",
              "hover:bg-muted/40 transition-colors",
            )}
          >
            Дополнительно: расписание дня и опции
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", moreOpen && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-4 space-y-4">
          <div className="space-y-2">
            <WizardRichTextField
              label="Расписание дня"
              helperText="Опционально: общий распорядок, если он одинаковый для всех смен."
              value={data.campDaySchedule}
              onChange={(value) => onChange({ campDaySchedule: value })}
              placeholder="Опционально: общий распорядок, если он одинаковый для всех смен"
              disabled={!isEditable}
              minHeight={140}
            />
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={data.campCanSelectDays}
                onChange={() => onChange({ campCanSelectDays: !data.campCanSelectDays })}
                disabled={!isEditable}
              />
              <span className="text-sm">Можно выбрать отдельные дни</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={data.campHasExtendedCare}
                onChange={() => onChange({ campHasExtendedCare: !data.campHasExtendedCare })}
                disabled={!isEditable}
              />
              <span className="text-sm">Есть продлённый день</span>
            </label>
          </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
