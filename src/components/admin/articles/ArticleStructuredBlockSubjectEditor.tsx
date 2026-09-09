"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  newArticleSubject,
  type ArticleSubject,
} from "@/lib/publications/articleMvp";

export function ArticleStructuredBlockSubjectEditor({
  value,
  availableSubjects,
  onChange,
}: {
  value: ArticleSubject;
  availableSubjects: ArticleSubject[];
  onChange: (subject: ArticleSubject) => void;
}) {
  const options = [
    value,
    ...availableSubjects.filter((subject) => subject.id !== value.id),
  ];

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.025] p-3">
      <div>
        <p className="text-sm font-medium text-foreground">Объект блока</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Контакты, стоимость и режим работы с одинаковым объектом объединяются в аналитике.
          Объект статьи не создаёт публикацию в каталоге mamaGo.
        </p>
      </div>

      {options.length > 1 ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Использовать объект</Label>
          <Select
            value={value.id}
            onValueChange={(id) => {
              const selected = options.find((subject) => subject.id === id);
              if (selected) onChange(selected);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите объект статьи" />
            </SelectTrigger>
            <SelectContent>
              {options.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.title.trim() || "Новый объект"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label>Что описывает этот блок?</Label>
        <Input
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="Например, Studio Kids или Boulangerie Dupont"
          maxLength={200}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">subject: {value.id}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 font-normal"
          onClick={() => onChange(newArticleSubject())}
        >
          <Plus className="h-3.5 w-3.5" />
          Новый объект
        </Button>
      </div>
    </div>
  );
}
