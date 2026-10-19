"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const widths = [
  { label: "320", px: 320 },
  { label: "375", px: 375 },
  { label: "768", px: 768 },
  { label: "Десктоп", px: 1200 },
] as const;

const examples = [
  { label: "Кнопки", id: "buttons" },
  { label: "Чипы", id: "chips" },
  { label: "Поля", id: "fields" },
  { label: "Бейджи", id: "badges" },
] as const;

export function PreviewWorkbench() {
  const [width, setWidth] = useState<number>(375);
  const [example, setExample] = useState<string>("buttons");

  return (
    <section id="device-preview" className="space-y-4 scroll-mt-36">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Интерактивный предпросмотр</h2>
        <p className="text-sm text-muted-foreground">Настоящий iframe меняет viewport, а не только ширину контейнера. Проверяйте также на физическом устройстве.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ширина предпросмотра">
        {widths.map((option) => (
          <Button key={option.px} size="sm" type="button" variant={width === option.px ? "default" : "outline"} aria-pressed={width === option.px} onClick={() => setWidth(option.px)}>
            {option.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Компонент предпросмотра">
        {examples.map((option) => (
          <Button key={option.id} size="sm" type="button" variant={example === option.id ? "secondary" : "ghost"} aria-pressed={example === option.id} onClick={() => setExample(option.id)}>
            {option.label}
          </Button>
        ))}
      </div>
      <div className="w-full overflow-x-auto rounded-2xl border border-border bg-surface-muted p-3 sm:p-5">
        <div className="mx-auto" style={{ width, maxWidth: "none" }}>
          <div className="mb-2 text-center text-xs text-muted-foreground">{width} px · iframe</div>
          <iframe
            key={example}
            title={`Предпросмотр: ${example}, ${width} пикселей`}
            src={`/ui-lab/preview?demo=${encodeURIComponent(example)}`}
            width={width}
            height={340}
            className="block rounded-xl border border-border bg-background"
          />
        </div>
      </div>
    </section>
  );
}
