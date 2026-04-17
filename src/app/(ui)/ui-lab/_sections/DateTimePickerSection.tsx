"use client";

import { useState } from "react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Card } from "@/components/ui/card";
import { ComponentMetaCard } from "@/components/ui-lab/ComponentMetaCard";
import { getComponentMeta } from "@/components/ui-lab/registry";

export function DateTimePickerSection() {
  const [date1, setDate1] = useState<Date | null>(null);
  const [time1, setTime1] = useState<string | null>(null);

  const [date2, setDate2] = useState<Date | null>(new Date());
  const [time2, setTime2] = useState<string | null>(null);

  const [date3, setDate3] = useState<Date | null>(new Date());
  const [time3, setTime3] = useState<string | null>("14:30");

  const [date4, setDate4] = useState<Date | null>(null);
  const [time4, setTime4] = useState<string | null>(null);

  const [date5, setDate5] = useState<Date | null>(null);
  const [time5, setTime5] = useState<string | null>(null);

  const [date6, setDate6] = useState<Date | null>(null);
  const [time6, setTime6] = useState<string | null>(null);

  const [date7, setDate7] = useState<Date | null>(null);
  const [time7, setTime7] = useState<string | null>(null);

  const componentMeta = getComponentMeta("date-time-picker", "ui-lab");

  return (
    <section id="date-time-picker" className="space-y-8">
      {componentMeta && (
        <ComponentMetaCard {...componentMeta}>
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Example 1: Default State */}
              <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Дефолтное состояние</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Без выбранной даты и времени
          </p>
          <DateTimePicker
            value={date1}
            time={time1}
            onDateChange={setDate1}
            onTimeChange={setTime1}
          />
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
            <div className="font-mono">
              <div>Дата: {date1 ? date1.toLocaleDateString("ru-RU") : "не выбрана"}</div>
              <div>Время: {time1 || "не выбрано"}</div>
            </div>
          </div>
        </Card>

        {/* Example 2: With Selected Date */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">С выбранной датой</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Дата выбрана, время доступно для выбора
          </p>
          <DateTimePicker
            value={date2}
            time={time2}
            onDateChange={setDate2}
            onTimeChange={setTime2}
          />
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
            <div className="font-mono">
              <div>Дата: {date2 ? date2.toLocaleDateString("ru-RU") : "не выбрана"}</div>
              <div>Время: {time2 || "не выбрано"}</div>
            </div>
          </div>
        </Card>

        {/* Example 3: With Date and Time */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">С датой и временем</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Полностью заполненное состояние
          </p>
          <DateTimePicker
            value={date3}
            time={time3}
            onDateChange={setDate3}
            onTimeChange={setTime3}
          />
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
            <div className="font-mono">
              <div>Дата: {date3 ? date3.toLocaleDateString("ru-RU") : "не выбрана"}</div>
              <div>Время: {time3 || "не выбрано"}</div>
            </div>
          </div>
        </Card>

        {/* Example 4: Disabled State */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Disabled состояние</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Компонент заблокирован для взаимодействия
          </p>
          <DateTimePicker
            value={date4}
            time={time4}
            onDateChange={setDate4}
            onTimeChange={setTime4}
            disabled
          />
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
            <div className="font-mono">
              <div>Дата: {date4 ? date4.toLocaleDateString("ru-RU") : "не выбрана"}</div>
              <div>Время: {time4 || "не выбрано"}</div>
            </div>
          </div>
        </Card>

        {/* Example 5: Custom Step (30 min) */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Кастомный шаг (30 мин)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Интервалы времени по 30 минут
          </p>
          <DateTimePicker
            value={date5}
            time={time5}
            onDateChange={setDate5}
            onTimeChange={setTime5}
            step={30}
          />
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
            <div className="font-mono">
              <div>Дата: {date5 ? date5.toLocaleDateString("ru-RU") : "не выбрана"}</div>
              <div>Время: {time5 || "не выбрано"}</div>
              <div className="text-xs text-muted-foreground mt-1">step=30</div>
            </div>
          </div>
        </Card>

        {/* Example 6: Limited Time Range */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Ограниченный диапазон</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Только рабочие часы: 09:00 - 18:00
          </p>
          <DateTimePicker
            value={date6}
            time={time6}
            onDateChange={setDate6}
            onTimeChange={setTime6}
            minTime="09:00"
            maxTime="18:00"
          />
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
            <div className="font-mono">
              <div>Дата: {date6 ? date6.toLocaleDateString("ru-RU") : "не выбрана"}</div>
              <div>Время: {time6 || "не выбрано"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                minTime=09:00, maxTime=18:00
              </div>
            </div>
          </div>
        </Card>

        {/* Example 7: Allow Past Dates */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Разрешить прошлые даты</h3>
          <p className="text-sm text-muted-foreground mb-4">
            disablePast=false - можно выбирать любые даты
          </p>
          <DateTimePicker
            value={date7}
            time={time7}
            onDateChange={setDate7}
            onTimeChange={setTime7}
            disablePast={false}
          />
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
            <div className="font-mono">
              <div>Дата: {date7 ? date7.toLocaleDateString("ru-RU") : "не выбрана"}</div>
              <div>Время: {time7 || "не выбрано"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                disablePast=false
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Usage Example */}
      <Card className="p-6 bg-muted/30">
        <h3 className="text-lg font-semibold mb-4">Пример использования</h3>
        <pre className="text-sm bg-background p-4 rounded-lg overflow-x-auto">
          <code>{`import { DateTimePicker } from "@/components/ui/date-time-picker";

function MyForm() {
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);

  return (
    <DateTimePicker
      value={date}
      time={time}
      onDateChange={setDate}
      onTimeChange={setTime}
      step={15}
      minTime="09:00"
      maxTime="18:00"
      labels={{
        time: "Дедлайн",
        placeholder: "Выберите время дедлайна"
      }}
    />
  );
}`}</code>
        </pre>
      </Card>

      {/* Props Documentation */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Props</h3>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">value</div>
            <div>
              <div className="font-medium">Date | null</div>
              <div className="text-muted-foreground">Выбранная дата</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">time</div>
            <div>
              <div className="font-medium">string | null</div>
              <div className="text-muted-foreground">Выбранное время в формате &quot;HH:mm&quot;</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">onDateChange</div>
            <div>
              <div className="font-medium">(date: Date | null) =&gt; void</div>
              <div className="text-muted-foreground">Callback при изменении даты</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">onTimeChange</div>
            <div>
              <div className="font-medium">(time: string) =&gt; void</div>
              <div className="text-muted-foreground">Callback при изменении времени</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">step</div>
            <div>
              <div className="font-medium">number (default: 15)</div>
              <div className="text-muted-foreground">Шаг времени в минутах</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">minTime</div>
            <div>
              <div className="font-medium">string</div>
              <div className="text-muted-foreground">Минимальное время в формате &quot;HH:mm&quot;</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">maxTime</div>
            <div>
              <div className="font-medium">string</div>
              <div className="text-muted-foreground">Максимальное время в формате &quot;HH:mm&quot;</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">disabled</div>
            <div>
              <div className="font-medium">boolean</div>
              <div className="text-muted-foreground">Отключить компонент</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b">
            <div className="font-mono font-semibold">disablePast</div>
            <div>
              <div className="font-medium">boolean (default: true)</div>
              <div className="text-muted-foreground">Запретить выбор прошлых дат</div>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div className="font-mono font-semibold">labels</div>
            <div>
              <div className="font-medium">{`{ time?: string; placeholder?: string }`}</div>
              <div className="text-muted-foreground">Кастомные лейблы для UI</div>
            </div>
          </div>
        </div>
      </Card>
          </div>
        </ComponentMetaCard>
      )}
    </section>
  );
}
