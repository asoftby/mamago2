"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Bold, Italic, List } from "lucide-react";
import type { PriceData, PriceItem } from "@/lib/priceItems";

interface PriceListEditorProps {
  value: PriceData;
  onChange: (data: PriceData) => void;
  disabled?: boolean;
}

function wrapSelection(
  ta: HTMLTextAreaElement,
  before: string,
  after: string,
  currentValue: string,
  onUpdate: (val: string) => void,
) {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = currentValue.slice(start, end) || "текст";
  const next = currentValue.slice(0, start) + before + selected + after + currentValue.slice(end);
  onUpdate(next);
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(start + before.length, start + before.length + selected.length);
  });
}

function toggleBullet(
  ta: HTMLTextAreaElement,
  currentValue: string,
  onUpdate: (val: string) => void,
) {
  const start = ta.selectionStart;
  const lineStart = currentValue.lastIndexOf("\n", start - 1) + 1;
  const hasBullet = currentValue.slice(lineStart).startsWith("- ");
  let next: string;
  let cursor: number;
  if (hasBullet) {
    next = currentValue.slice(0, lineStart) + currentValue.slice(lineStart + 2);
    cursor = Math.max(lineStart, start - 2);
  } else {
    next = currentValue.slice(0, lineStart) + "- " + currentValue.slice(lineStart);
    cursor = start + 2;
  }
  onUpdate(next);
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(cursor, cursor);
  });
}

export function PriceListEditor({ value, onChange, disabled }: PriceListEditorProps) {
  const { items, note } = value;
  const taRef = useRef<HTMLTextAreaElement>(null);

  function add() {
    const id = Math.random().toString(36).slice(2, 8);
    onChange({ ...value, items: [...items, { id, label: "", price: "", unit: "BYN" }] });
  }

  function remove(id: string) {
    onChange({ ...value, items: items.filter((item) => item.id !== id) });
  }

  function updateItem(id: string, field: keyof PriceItem, val: string) {
    onChange({
      ...value,
      items: items.map((item) => (item.id === id ? { ...item, [field]: val } : item)),
    });
  }

  function updateNote(val: string) {
    onChange({ ...value, note: val });
  }

  function handleBold() {
    if (!taRef.current || disabled) return;
    wrapSelection(taRef.current, "**", "**", note, updateNote);
  }

  function handleItalic() {
    if (!taRef.current || disabled) return;
    wrapSelection(taRef.current, "*", "*", note, updateNote);
  }

  function handleBullet() {
    if (!taRef.current || disabled) return;
    toggleBullet(taRef.current, note, updateNote);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground w-5 text-right shrink-0">{index + 1}.</span>
            <Input
              className="flex-1"
              placeholder="Название (напр. Взрослый)"
              value={item.label}
              onChange={(e) => updateItem(item.id, "label", e.target.value)}
              disabled={disabled}
            />
            <Input
              className="w-28"
              placeholder="Цена"
              value={item.price}
              onChange={(e) => updateItem(item.id, "price", e.target.value)}
              disabled={disabled}
            />
            <Input
              className="w-20"
              placeholder="BYN"
              value={item.unit}
              onChange={(e) => updateItem(item.id, "unit", e.target.value)}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(item.id)}
              disabled={disabled}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={disabled}
          className="gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить строку
        </Button>
      </div>

      <div className="rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-input bg-muted/30">
          <button
            type="button"
            title="Жирный (**текст**)"
            onClick={handleBold}
            disabled={disabled}
            className="p-1 rounded hover:bg-accent disabled:opacity-40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Курсив (*текст*)"
            onClick={handleItalic}
            disabled={disabled}
            className="p-1 rounded hover:bg-accent disabled:opacity-40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-border mx-0.5" />
          <button
            type="button"
            title="Маркированный список"
            onClick={handleBullet}
            disabled={disabled}
            className="p-1 rounded hover:bg-accent disabled:opacity-40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
        <Textarea
          ref={taRef}
          placeholder="Дополнительная информация о ценах (скидки, акции, условия…)"
          value={note}
          onChange={(e) => updateNote(e.target.value)}
          disabled={disabled}
          rows={6}
          className="resize-none text-sm border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}
