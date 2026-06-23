"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FaqItem } from "@/lib/faq/faqItems";

export type FaqStepKind = "place" | "offer" | "event";

type FaqStepProps = {
  kind: FaqStepKind;
  value: FaqItem[];
  onChange: (items: FaqItem[]) => void;
};

const COPY: Record<FaqStepKind, {
  title: string;
  description: string;
  hint?: string;
  examples: string[];
}> = {
  place: {
    title: "Частые вопросы",
    description: "Добавьте ответы на вопросы, которые родители обычно уточняют перед визитом. Этот шаг необязательный.",
    hint: "Рекомендуем добавить 3–5 вопросов — это поможет родителям быстрее принять решение.",
    examples: [
      "Можно ли с коляской?",
      "Есть ли парковка рядом?",
      "Нужно ли бронировать заранее?",
      "С какого возраста подходит место?",
    ],
  },
  offer: {
    title: "Частые вопросы",
    description: "Добавьте ответы на вопросы, которые помогут родителям быстрее принять решение. Этот шаг необязательный.",
    hint: "Рекомендуем добавить 3–5 вопросов, если у предложения есть важные условия.",
    examples: [
      "Что входит в стоимость?",
      "Нужна ли предоплата?",
      "Можно ли перенести дату?",
      "Что нужно взять с собой?",
    ],
  },
  event: {
    title: "Частые вопросы",
    description: "Этот шаг необязательный. Добавьте блок с вопросами, только если есть важные уточнения для родителей.",
    examples: [
      "Нужно ли приходить заранее?",
      "Можно ли вернуть билет?",
      "Подходит ли событие для малышей?",
      "Что взять с собой?",
    ],
  },
};

function createFaqDraft(): FaqItem {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `faq-${Date.now()}`,
    question: "",
    answer: "",
    position: 0,
  };
}

export function FaqStep({ kind, value, onChange }: FaqStepProps) {
  const copy = COPY[kind];
  const items = Array.isArray(value) ? value : [];

  const updateItem = (id: string, patch: Partial<FaqItem>) => {
    onChange(
      items.map((item, index) =>
        item.id === id ? { ...item, ...patch, position: index } : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    onChange(
      items.filter((item) => item.id !== id).map((item, index) => ({ ...item, position: index })),
    );
  };

  const addItem = () => {
    if (items.length >= 10) return;
    onChange(
      [...items, createFaqDraft()].map((item, index) => ({ ...item, position: index })),
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{copy.description}</p>
        {copy.hint ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {copy.hint}
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/40 p-6">
          <p className="text-sm text-muted-foreground">
            Пока вопросов нет. Добавьте блок с вопросами, только если он действительно поможет родителям быстрее разобраться.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {copy.examples.map((example) => (
              <span
                key={example}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
              >
                {example}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((item, index) => {
          const hasQuestion = item.question.trim().length > 0;
          const hasAnswer = item.answer.trim().length > 0;
          const questionError = !hasQuestion && hasAnswer;
          const answerError = hasQuestion && !hasAnswer;

          return (
            <div key={item.id} className="rounded-3xl border border-border bg-background p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">Вопрос {index + 1}</div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                  Удалить
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${item.id}-question`}>Вопрос</Label>
                  <Input
                    id={`${item.id}-question`}
                    value={item.question}
                    placeholder={copy.examples[index % copy.examples.length] ?? "Введите вопрос"}
                    onChange={(event) => updateItem(item.id, { question: event.target.value })}
                  />
                  {questionError ? (
                    <p className="text-sm text-destructive">Заполните вопрос, чтобы сохранить ответ.</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${item.id}-answer`}>Ответ</Label>
                  <Textarea
                    id={`${item.id}-answer`}
                    rows={4}
                    value={item.answer}
                    placeholder="Коротко и понятно ответьте родителям"
                    onChange={(event) => updateItem(item.id, { answer: event.target.value })}
                  />
                  {answerError ? (
                    <p className="text-sm text-destructive">Добавьте ответ, если вопрос уже заполнен.</p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Можно добавить до 10 вопросов.</p>
        <Button type="button" variant="outline" onClick={addItem} disabled={items.length >= 10}>
          Добавить вопрос
        </Button>
      </div>
    </div>
  );
}
