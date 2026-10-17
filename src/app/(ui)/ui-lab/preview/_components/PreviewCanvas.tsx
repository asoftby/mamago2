"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Chip } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PreviewCanvas({ demo }: { demo: string }) {
  const [choice, setChoice] = useState("free");

  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <div className="mb-5 space-y-1">
        <h1 className="text-lg font-semibold">{({ buttons: "Кнопки", chips: "Чипы", fields: "Поля ввода", badges: "Бейджи" } as Record<string, string>)[demo] ?? "Предпросмотр"}</h1>
        <p className="text-xs text-muted-foreground">Текущие компоненты, без замены исходных стилей.</p>
      </div>
      {demo === "buttons" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button>Основная</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="outline">Контурная</Button>
          <Button size="lg">Большая</Button>
          <PrimaryButton>Legacy CTA</PrimaryButton>
          <Button disabled>Недоступна</Button>
        </div>
      )}
      {demo === "chips" && (
        <div role="group" aria-label="Фильтр цены" className="flex flex-wrap gap-2">
          {[{ id: "all", label: "Любая" }, { id: "free", label: "Бесплатно" }, { id: "paid", label: "Платно" }].map((item) => (
            <Chip key={item.id} type="button" active={choice === item.id} aria-pressed={choice === item.id} onClick={() => setChoice(item.id)}>
              {item.label}
            </Chip>
          ))}
          <Chip disabled>Disabled</Chip>
        </div>
      )}
      {demo === "fields" && (
        <div className="max-w-md space-y-4">
          <label className="grid gap-1.5 text-sm">Название события<Input placeholder="Семейный фестиваль" /></label>
          <label className="grid gap-1.5 text-sm">Комментарий<Textarea placeholder="Добавьте подробности" rows={2} /></label>
          <label className="grid gap-1.5 text-sm">
            Ошибка
            <Input defaultValue="Ошибка" aria-invalid="true" aria-describedby="preview-error" />
            <span id="preview-error" className="text-xs text-danger">Проверьте значение</span>
          </label>
        </div>
      )}
      {demo === "badges" && (
        <div className="flex flex-wrap gap-2">
          <Badge>Опубликовано</Badge>
          <Badge variant="secondary">Событие</Badge>
          <Badge variant="outline">Нейтральный</Badge>
          <Badge variant="destructive">Отклонено</Badge>
        </div>
      )}
    </main>
  );
}
