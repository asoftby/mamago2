"use client";

import { useState } from "react";
import { OpeningHoursEditor, OpeningHoursPreview } from "@/components/openingHours";
import { getOpeningStatus } from "@/server/services/openingHours";
import type { OpeningHoursData } from "@/components/openingHours";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import { ComponentMetaCard } from "@/components/ui-lab/ComponentMetaCard";
import { getComponentMeta } from "@/components/ui-lab/registry";

/**
 * Convert UI data to server format for preview
 */
function convertToServerFormat(data: OpeningHoursData): OpeningHoursWithRelations {
  return {
    id: "preview",
    mode: data.mode,
    timezone: data.timezone,
    note: data.note || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    rules: data.rules.map((rule) => ({
      id: `rule-${rule.dayOfWeek}`,
      openingHoursId: "preview",
      dayOfWeek: rule.dayOfWeek,
      isOpen: rule.isOpen,
      allDay: rule.allDay,
      intervals: rule.intervals.map((interval, idx) => ({
        id: `interval-${rule.dayOfWeek}-${idx}`,
        ruleId: `rule-${rule.dayOfWeek}`,
        startTime: interval.startTime,
        endTime: interval.endTime,
        sortOrder: idx,
      })),
    })),
    exceptions: [],
  };
}

export function OpeningHoursSection() {
  const [editorData, setEditorData] = useState<OpeningHoursData | null>(null);

  // Convert to server format for preview
  const serverData = editorData ? convertToServerFormat(editorData) : null;
  const status = serverData ? getOpeningStatus(serverData, new Date()) : null;

  const componentMeta = getComponentMeta("opening-hours-preview", "ui-lab");

  return (
    <section id="opening-hours" className="space-y-8">
      {componentMeta && (
        <ComponentMetaCard {...componentMeta}>
          <div className="space-y-8">
            {/* Editor */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">OpeningHoursEditor</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Controlled component для редактирования режима работы. Поддерживает 4 режима:
                  WEEKLY, ALWAYS_OPEN, BY_APPOINTMENT, TEMPORARILY_CLOSED.
                </p>
              </div>

              <div className="border rounded-lg p-6 bg-card">
                <OpeningHoursEditor
                  value={editorData}
                  onChange={setEditorData}
                  timezone="Europe/Minsk"
                />
              </div>
            </div>

            {/* Preview */}
            {serverData && status && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">OpeningHoursPreview</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Компонент для отображения текущего статуса и недельного графика.
                    Использует server-side функцию getOpeningStatus для расчета статуса.
                  </p>
                </div>

                <OpeningHoursPreview
                  openingHours={serverData}
                  status={status}
                />
              </div>
            )}

            {/* Examples */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">Примеры состояний</h3>
              </div>

              <div className="grid gap-4">
          {/* Example 1: WEEKLY mode */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-2">1. Недельный график (WEEKLY)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Стандартный режим с расписанием по дням недели. Поддерживает до 2 интервалов на день.
            </p>
            <OpeningHoursPreview
              openingHours={convertToServerFormat({
                mode: "WEEKLY",
                timezone: "Europe/Minsk",
                rules: [
                  {
                    dayOfWeek: "MON",
                    isOpen: true,
                    allDay: false,
                    intervals: [{ startTime: "09:00", endTime: "18:00" }],
                  },
                  {
                    dayOfWeek: "TUE",
                    isOpen: true,
                    allDay: false,
                    intervals: [{ startTime: "09:00", endTime: "18:00" }],
                  },
                  {
                    dayOfWeek: "WED",
                    isOpen: true,
                    allDay: false,
                    intervals: [{ startTime: "09:00", endTime: "18:00" }],
                  },
                  {
                    dayOfWeek: "THU",
                    isOpen: true,
                    allDay: false,
                    intervals: [{ startTime: "09:00", endTime: "18:00" }],
                  },
                  {
                    dayOfWeek: "FRI",
                    isOpen: true,
                    allDay: false,
                    intervals: [{ startTime: "09:00", endTime: "18:00" }],
                  },
                  {
                    dayOfWeek: "SAT",
                    isOpen: false,
                    allDay: false,
                    intervals: [],
                  },
                  {
                    dayOfWeek: "SUN",
                    isOpen: false,
                    allDay: false,
                    intervals: [],
                  },
                ],
              })}
              status={getOpeningStatus(
                convertToServerFormat({
                  mode: "WEEKLY",
                  timezone: "Europe/Minsk",
                  rules: [
                    {
                      dayOfWeek: "MON",
                      isOpen: true,
                      allDay: false,
                      intervals: [{ startTime: "09:00", endTime: "18:00" }],
                    },
                    {
                      dayOfWeek: "TUE",
                      isOpen: true,
                      allDay: false,
                      intervals: [{ startTime: "09:00", endTime: "18:00" }],
                    },
                    {
                      dayOfWeek: "WED",
                      isOpen: true,
                      allDay: false,
                      intervals: [{ startTime: "09:00", endTime: "18:00" }],
                    },
                    {
                      dayOfWeek: "THU",
                      isOpen: true,
                      allDay: false,
                      intervals: [{ startTime: "09:00", endTime: "18:00" }],
                    },
                    {
                      dayOfWeek: "FRI",
                      isOpen: true,
                      allDay: false,
                      intervals: [{ startTime: "09:00", endTime: "18:00" }],
                    },
                    {
                      dayOfWeek: "SAT",
                      isOpen: false,
                      allDay: false,
                      intervals: [],
                    },
                    {
                      dayOfWeek: "SUN",
                      isOpen: false,
                      allDay: false,
                      intervals: [],
                    },
                  ],
                }),
                new Date()
              )}
            />
          </div>

          {/* Example 2: ALWAYS_OPEN */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-2">2. Круглосуточно (ALWAYS_OPEN)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Место работает 24/7 без выходных.
            </p>
            <OpeningHoursPreview
              openingHours={convertToServerFormat({
                mode: "ALWAYS_OPEN",
                timezone: "Europe/Minsk",
                rules: [],
              })}
              status={getOpeningStatus(
                convertToServerFormat({
                  mode: "ALWAYS_OPEN",
                  timezone: "Europe/Minsk",
                  rules: [],
                }),
                new Date()
              )}
            />
          </div>

          {/* Example 3: BY_APPOINTMENT */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-2">3. По записи (BY_APPOINTMENT)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Посещение только по предварительной записи.
            </p>
            <OpeningHoursPreview
              openingHours={convertToServerFormat({
                mode: "BY_APPOINTMENT",
                timezone: "Europe/Minsk",
                rules: [],
              })}
              status={getOpeningStatus(
                convertToServerFormat({
                  mode: "BY_APPOINTMENT",
                  timezone: "Europe/Minsk",
                  rules: [],
                }),
                new Date()
              )}
            />
          </div>

          {/* Example 4: TEMPORARILY_CLOSED */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-2">4. Временно закрыто (TEMPORARILY_CLOSED)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Место временно не работает с опциональным примечанием.
            </p>
            <OpeningHoursPreview
              openingHours={convertToServerFormat({
                mode: "TEMPORARILY_CLOSED",
                timezone: "Europe/Minsk",
                note: "Закрыто на ремонт до 15 марта",
                rules: [],
              })}
              status={getOpeningStatus(
                convertToServerFormat({
                  mode: "TEMPORARILY_CLOSED",
                  timezone: "Europe/Minsk",
                  note: "Закрыто на ремонт до 15 марта",
                  rules: [],
                }),
                new Date()
              )}
            />
          </div>
                </div>
              </div>

              {/* Props documentation */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Props интерфейсы</h3>
                </div>

                <div className="space-y-4">
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-mono text-sm font-medium mb-2">OpeningHoursEditor</h4>
                    <pre className="text-xs overflow-x-auto">
{`interface OpeningHoursEditorProps {
  value: OpeningHoursData | null;
  onChange: (value: OpeningHoursData) => void;
  timezone?: string; // default: "Europe/Minsk"
}`}
                    </pre>
                  </div>

                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-mono text-sm font-medium mb-2">OpeningHoursPreview</h4>
                    <pre className="text-xs overflow-x-auto">
{`interface OpeningHoursPreviewProps {
  openingHours: OpeningHoursWithRelations;
  status: OpeningStatus;
  className?: string;
}`}
                    </pre>
                  </div>

                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-mono text-sm font-medium mb-2">OpeningHoursData</h4>
                    <pre className="text-xs overflow-x-auto">
{`interface OpeningHoursData {
  mode: OpeningHoursMode;
  timezone: string;
  note?: string;
  rules: DayRule[];
}

interface DayRule {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  allDay: boolean;
  intervals: TimeInterval[];
}

interface TimeInterval {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </ComponentMetaCard>
        )}
      </section>
    );
  }

