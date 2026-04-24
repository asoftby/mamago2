"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import { UnpLookupField } from "@/components/business/UnpLookupField";
import type { OrganizerData } from "./types";

interface OrganizerCreateFormProps {
  data: Omit<OrganizerData, "mode" | "id">;
  onChange: (updates: Partial<Omit<OrganizerData, "mode" | "id">>) => void;
  isEditable: boolean;
  showHeader?: boolean;
  onUnpResolved?: (result: { legalName: string | null; source: string | null }) => void;
  onUnpReset?: () => void;
}

export function OrganizerCreateForm({
  data,
  onChange,
  isEditable,
  showHeader = true,
  onUnpResolved,
  onUnpReset,
}: OrganizerCreateFormProps) {
  return (
    <div>
      {showHeader ? (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-primary">Данные организатора</h3>
          <p className="text-sm text-primary/80">Укажите информацию о новом организаторе</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <Label htmlFor="organizer-name">
            Название организатора <span className="text-red-500">*</span>
          </Label>
          <Input
            id="organizer-name"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Например: Арт-студия Porto"
            disabled={!isEditable}
            className="mt-1"
          />
        </div>

        <div>
          <UnpLookupField
            id="organizer-unp"
            label="УНП"
            value={data.unp ?? ""}
            onValueChange={(value) => onChange({ unp: value })}
            disabled={!isEditable}
            placeholder="Например: 123456789"
            helperText="Если это юридическое лицо, укажите УНП — мы попробуем определить организацию автоматически."
            onResolved={onUnpResolved}
            onReset={onUnpReset}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="organizer-phone">Телефон</Label>
            <InternationalPhoneInput
              id="organizer-phone"
              value={data.phone}
              onChange={(phone) => onChange({ phone })}
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

        <div>
          <Label htmlFor="organizer-instagram">Instagram</Label>
          <Input
            id="organizer-instagram"
            value={data.instagram}
            onChange={(e) => onChange({ instagram: e.target.value })}
            placeholder="@organizer или https://instagram.com/organizer"
            disabled={!isEditable}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}
