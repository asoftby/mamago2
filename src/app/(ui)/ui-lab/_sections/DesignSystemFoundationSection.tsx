"use client";

import * as React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Chip } from "@/components/ui/Chip";
import { ChipsRow } from "@/components/ui/chips-row";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { CloseIcon } from "@/components/ui/close-icon";

export function DesignSystemFoundationSection() {
  const [selectedPrice, setSelectedPrice] = React.useState("free");
  const [selectedAge, setSelectedAge] = React.useState("3-6");
  const [closeDemoOpen, setCloseDemoOpen] = React.useState(true);

  return (
    <DemoSection
      id="design-system-foundation"
      title="mamaGo Design System — Foundation"
      description="Current live variants and interaction states for review; this page does not silently restyle production controls."
    >
      <p className="text-sm text-muted-foreground">
        Source of truth: docs/design-system.md and semantic tokens in globals.css.
        Navigate with Tab to inspect focus states. Check mobile widths before approving global changes.
      </p>
      <InventoryGrid>
        <RenderSafe title="Buttons — variants" file="src/components/ui/button.tsx">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Основная</Button>
            <Button variant="secondary">Вторичная</Button>
            <Button variant="outline">Контурная</Button>
            <Button variant="ghost">Прозрачная</Button>
            <Button variant="link">Ссылка</Button>
            <Button variant="destructive">Удалить</Button>
          </div>
        </RenderSafe>

        <RenderSafe title="Buttons — sizes and states" file="src/components/ui/button.tsx">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xs">XS</Button>
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Недоступна</Button>
          </div>
        </RenderSafe>

        <RenderSafe title="Legacy PrimaryButton — compare before migration" file="src/components/ui/PrimaryButton.tsx">
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton>Продолжить</PrimaryButton>
            <Button>Button default</Button>
            <Button size="lg">Button large</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Differences in height, padding and radius must be resolved at the primitive level.
          </p>
        </RenderSafe>

        <RenderSafe title="Close — одна иконка и единая кнопка закрытия" file="src/components/ui/modal-close-button.tsx">
          <p className="mb-3 text-xs text-muted-foreground">
            Каноническая X: src/components/ui/close-icon.tsx. Кнопка: ModalCloseButton.
            Везде подпись для скринридеров «Закрыть»; круглая область нажатия 40 или 44 px.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="mb-2 text-xs text-muted-foreground">Обычная · 40 px</p>
              <ModalCloseButton onClick={() => setCloseDemoOpen(false)} />
            </div>
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="mb-2 text-xs text-muted-foreground">Touch · 44 px</p>
              <ModalCloseButton size="touch" onClick={() => setCloseDemoOpen(false)} />
            </div>
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="mb-2 text-xs text-muted-foreground">Disabled</p>
              <ModalCloseButton disabled />
            </div>
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="mb-2 text-xs text-muted-foreground">Иконка без кнопки</p>
              <CloseIcon />
            </div>
          </div>
          <div aria-live="polite" className="mt-3 text-xs text-muted-foreground">
            {closeDemoOpen ? "Демонстрационный слой открыт." : "Слой закрыт."}
          </div>
          {!closeDemoOpen && <Button size="sm" variant="outline" onClick={() => setCloseDemoOpen(true)} className="mt-2">Открыть снова</Button>}
        </RenderSafe>

        <RenderSafe title="Chip — interactive single choice" file="src/components/ui/Chip.tsx">
          <div role="group" aria-label="Стоимость" className="flex flex-wrap gap-2">
            {[{ id: "all", label: "Любая" }, { id: "free", label: "Бесплатно" }, { id: "paid", label: "Платно" }].map((option) => (
              <Chip
                key={option.id}
                type="button"
                active={selectedPrice === option.id}
                aria-pressed={selectedPrice === option.id}
                onClick={() => setSelectedPrice(option.id)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </RenderSafe>

        <RenderSafe title="ChipsRow — horizontal selection" file="src/components/ui/chips-row.tsx">
          <ChipsRow
            aria-label="Возраст"
            items={[
              { id: "0-3", label: "0–3 года", active: selectedAge === "0-3", onClick: () => setSelectedAge("0-3") },
              { id: "3-6", label: "3–6 лет", active: selectedAge === "3-6", onClick: () => setSelectedAge("3-6") },
              { id: "6-12", label: "6–12 лет", active: selectedAge === "6-12", onClick: () => setSelectedAge("6-12") },
            ]}
          />
        </RenderSafe>

        <RenderSafe title="Badge — informational, not selectable" file="src/components/ui/badge.tsx">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Опубликовано</Badge>
            <Badge variant="secondary">Событие</Badge>
            <Badge variant="outline">Ожидает</Badge>
            <Badge variant="destructive">Отклонено</Badge>
          </div>
        </RenderSafe>

        <RenderSafe title="Input — default, invalid, disabled" file="src/components/ui/input.tsx">
          <div className="grid w-full max-w-md gap-3">
            <label className="grid gap-1 text-sm">
              Название
              <Input placeholder="Введите название" />
            </label>
            <label className="grid gap-1 text-sm">
              Ошибка заполнения
              <Input aria-invalid="true" aria-describedby="ds-input-error" defaultValue="Некорректное значение" />
              <span id="ds-input-error" className="text-xs text-danger">Проверьте введённые данные</span>
            </label>
            <label className="grid gap-1 text-sm">
              Недоступно
              <Input value="Нельзя изменить" disabled readOnly />
            </label>
          </div>
        </RenderSafe>

        <RenderSafe title="Textarea — mobile typography" file="src/components/ui/textarea.tsx">
          <label className="grid w-full max-w-md gap-2 text-sm">
            Комментарий
            <Textarea placeholder="Напишите комментарий" rows={3} />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            On iPhone text-entry font size should remain at least 16px to avoid automatic input zoom.
          </p>
        </RenderSafe>
      </InventoryGrid>
    </DemoSection>
  );
}
