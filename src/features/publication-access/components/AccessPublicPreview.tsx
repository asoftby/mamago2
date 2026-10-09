"use client";

import { ACCESS_METHOD_CONFIG } from "../config";
import type { PublicationAccess, PublicationEntityType } from "../types";

type AccessPublicPreviewProps = {
  title: string;
  value: PublicationAccess;
  entityType: PublicationEntityType;
};

export function AccessPublicPreview({
  title,
  value,
  entityType,
}: AccessPublicPreviewProps) {
  const config = ACCESS_METHOD_CONFIG[value.method];
  const hidesPublicAction = entityType === "event" && value.method === "details";

  return (
    <div className="rounded-xl bg-white px-4 py-4">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <div className="mt-4">
        {hidesPublicAction ? (
          <p className="text-[12px] text-gray-600">
            Отдельной кнопки на странице события не будет
          </p>
        ) : (
          <div className="inline-flex min-h-[52px] min-w-[184px] items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground sm:min-w-[214px]">
            {config.publicButtonLabel}
          </div>
        )}
      </div>

      {value.instructions?.trim() ? (
        <p className="mt-3 text-[12px] text-gray-600">{value.instructions}</p>
      ) : null}

      {value.method === "timeslots" && value.timeSlots && value.timeSlots.length > 0 ? (
        <div className="mt-3 space-y-1">
          {value.timeSlots.slice(0, 3).map((slot) => (
            <div key={slot.id} className="text-[12px] text-gray-600">
              {slot.date}: {slot.startTime}
              {slot.endTime ? ` - ${slot.endTime}` : ""}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

