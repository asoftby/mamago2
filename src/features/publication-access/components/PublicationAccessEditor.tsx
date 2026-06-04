"use client";

import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACCESS_METHOD_CONFIG } from "../config";
import { DEFAULT_ACCESS_METHODS_BY_ENTITY } from "../defaults";
import { PUBLICATION_ACCESS_LABELS } from "../labels";
import { AccessMethodCard } from "./AccessMethodCard";
import { AccessPublicPreview } from "./AccessPublicPreview";
import { TimeSlotEditor } from "./TimeSlotEditor";
import type {
  PublicationAccess,
  PublicationAccessMethod,
  PublicationEntityType,
} from "../types";

export type PublicationAccessEditorProps = {
  entityType: PublicationEntityType;
  value: PublicationAccess;
  onChange: (value: PublicationAccess) => void;
  allowedMethods?: PublicationAccessMethod[];
  disabled?: boolean;
  showPreview?: boolean;
};

export function PublicationAccessEditor({
  entityType,
  value,
  onChange,
  allowedMethods,
  disabled,
  showPreview = true,
}: PublicationAccessEditorProps) {
  const labels = PUBLICATION_ACCESS_LABELS[entityType];
  const methods = allowedMethods ?? DEFAULT_ACCESS_METHODS_BY_ENTITY[entityType];

  const setMethod = (method: PublicationAccessMethod) => {
    onChange({ ...value, method });
  };

  const update = (patch: Partial<PublicationAccess>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{labels.sectionTitle}</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {labels.sectionDescription}
        </p>
      </div>

      <div className="space-y-3">
        {methods.map((method) => {
          const config = ACCESS_METHOD_CONFIG[method];
          const isSelected = value.method === method;

          return (
            <AccessMethodCard
              key={method}
              title={config.title}
              description={config.description}
              icon={config.icon}
              selected={isSelected}
              disabled={disabled}
              onClick={() => setMethod(method)}
            >
              {showPreview ? (
                <AccessPublicPreview title={labels.previewTitle} value={value} />
              ) : null}

              {config.requiresUrl && config.urlField === "ticketUrl" ? (
                <div className="space-y-2">
                  <Label htmlFor="publication-ticket-url">Ссылка на покупку билета</Label>
                  <Input
                    id="publication-ticket-url"
                    type="url"
                    value={value.ticketUrl ?? ""}
                    onChange={(event) => update({ ticketUrl: event.target.value })}
                    placeholder="https://..."
                    disabled={disabled}
                  />
                </div>
              ) : null}

              {config.requiresUrl && config.urlField === "externalUrl" ? (
                <div className="space-y-2">
                  <Label htmlFor="publication-external-url">Ссылка</Label>
                  <Input
                    id="publication-external-url"
                    type="url"
                    value={value.externalUrl ?? ""}
                    onChange={(event) => update({ externalUrl: event.target.value })}
                    placeholder="https://..."
                    disabled={disabled}
                  />
                </div>
              ) : null}

              {method === "contact" ? (
                <div className="space-y-2">
                  <Label htmlFor="publication-phone">Телефон</Label>
                  <InternationalPhoneInput
                    id="publication-phone"
                    value={value.phone ?? ""}
                    onChange={(phone) => update({ phone })}
                    placeholder="+375 29 123 45 67"
                    disabled={disabled}
                  />
                </div>
              ) : null}

              {method === "prebooking" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="publication-prebooking-phone">
                      Телефон для связи
                    </Label>
                    <InternationalPhoneInput
                      id="publication-prebooking-phone"
                      value={value.phone ?? ""}
                      onChange={(phone) => update({ phone })}
                      placeholder="+375 29 123 45 67"
                      disabled={disabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="publication-prebooking-url">
                      Ссылка для записи
                    </Label>
                    <Input
                      id="publication-prebooking-url"
                      type="url"
                      value={value.externalUrl ?? ""}
                      onChange={(event) =>
                        update({ externalUrl: event.target.value })
                      }
                      placeholder="https://..."
                      disabled={disabled}
                    />
                  </div>
                </div>
              ) : null}

              {config.supportsTimeSlots ? (
                <TimeSlotEditor
                  entityType={entityType}
                  value={value.timeSlots ?? []}
                  onChange={(timeSlots) => update({ timeSlots })}
                  disabled={disabled}
                />
              ) : null}

              {method !== "details" ? (
                <div className="space-y-2">
                  <Label htmlFor={`publication-instructions-${method}`}>
                    {labels.instructionsLabel}
                  </Label>
                  <Textarea
                    id={`publication-instructions-${method}`}
                    value={value.instructions ?? ""}
                    onChange={(event) =>
                      update({ instructions: event.target.value })
                    }
                    placeholder="Например: подтверждаем запись в течение дня, отправляем детали в сообщении..."
                    rows={3}
                    disabled={disabled}
                  />
                </div>
              ) : null}
            </AccessMethodCard>
          );
        })}
      </div>
    </div>
  );
}
