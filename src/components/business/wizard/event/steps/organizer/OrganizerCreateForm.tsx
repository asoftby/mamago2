"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OrganizerData } from "./types";

interface OrganizerCreateFormProps {
  data: Omit<OrganizerData, "mode" | "id">;
  onChange: (updates: Partial<Omit<OrganizerData, "mode" | "id">>) => void;
  isEditable: boolean;
}

export function OrganizerCreateForm({ data, onChange, isEditable }: OrganizerCreateFormProps) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-primary">Данные организатора</h3>
        <p className="text-sm text-primary/80">Укажите информацию о новом организаторе</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="organizer-name">
            Название организатора <span className="text-red-500">*</span>
          </Label>
          <Input
            id="organizer-name"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Название организации или имя"
            disabled={!isEditable}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="organizer-description">Описание</Label>
          <Textarea
            id="organizer-description"
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Краткое описание организатора..."
            rows={2}
            disabled={!isEditable}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="organizer-phone">Телефон</Label>
            <Input
              id="organizer-phone"
              type="tel"
              value={data.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="+375 29 123 45 67"
              disabled={!isEditable}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="organizer-website">Сайт</Label>
            <Input
              id="organizer-website"
              type="url"
              value={data.website}
              onChange={(e) => onChange({ website: e.target.value })}
              placeholder="https://example.com"
              disabled={!isEditable}
              className="mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}