"use client";

import * as React from "react";
import type { Action, ExternalToast, ToastT } from "sonner";
import { toast as sonnerToast } from "sonner";
import {
  LiquidNotification,
  type LiquidNotificationVariant,
} from "@/components/ui/liquid-notification";

type ToastMessage = Parameters<typeof sonnerToast>[0];

function isAction(x: Action | React.ReactNode | undefined): x is Action {
  return (
    typeof x === "object" &&
    x !== null &&
    "label" in x &&
    "onClick" in x &&
    typeof (x as Action).onClick === "function"
  );
}

function asStringDescription(
  d: ExternalToast["description"],
): string | undefined {
  if (d == null) return undefined;
  if (typeof d === "string") return d;
  if (typeof d === "number") return String(d);
  return undefined;
}

function pickPrimaryAction(data?: ExternalToast) {
  if (!data) return undefined;
  const { action, cancel } = data;
  if (action && isAction(action)) {
    const a = action;
    return {
      label: String(a.label),
      run: () => {
        const ev = {
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new MouseEvent("click"),
        } as unknown as React.MouseEvent<HTMLButtonElement>;
        a.onClick(ev);
      },
    };
  }
  if (cancel && isAction(cancel)) {
    const c = cancel;
    return {
      label: String(c.label),
      run: () => {
        const ev = {
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new MouseEvent("click"),
        } as unknown as React.MouseEvent<HTMLButtonElement>;
        c.onClick(ev);
      },
    };
  }
  return undefined;
}

function isSimpleMessage(message: ToastMessage): message is string | number {
  return typeof message === "string" || typeof message === "number";
}

function delegateNative(
  variant: LiquidNotificationVariant,
  message: ToastMessage,
  data?: ExternalToast,
) {
  switch (variant) {
    case "success":
      return sonnerToast.success(message, data);
    case "error":
      return sonnerToast.error(message, data);
    case "warning":
      return sonnerToast.warning(message, data);
    case "info":
      return sonnerToast.info(message, data);
    default:
      return sonnerToast(message, data);
  }
}

function pushLiquid(
  variant: LiquidNotificationVariant,
  message: ToastMessage,
  data?: ExternalToast,
) {
  if (!isSimpleMessage(message)) {
    return delegateNative(variant, message, data);
  }

  const title = String(message);
  const description = asStringDescription(data?.description);
  const primary = pickPrimaryAction(data);
  const duration = data?.duration ?? 2500;
  // Generate a stable id upfront so the close handler can reference it reliably
  const id: string | number = data?.id ?? `lq-${Math.random().toString(36).slice(2)}`;

  return sonnerToast.custom(
    () => (
      <LiquidNotification
        variant={variant}
        title={title}
        description={description}
        actionLabel={primary?.label}
        onAction={primary?.run}
        onClose={() => {
          sonnerToast.dismiss(id);
          data?.onDismiss?.({ id } as unknown as ToastT);
        }}
      />
    ),
    {
      id,
      duration,
      className: "!w-auto !max-w-none !border-0 !bg-transparent !p-0 !shadow-none pointer-events-auto",
      onAutoClose: data?.onAutoClose,
    },
  );
}

function baseToast(message: ToastMessage, data?: ExternalToast) {
  if (isSimpleMessage(message)) {
    return pushLiquid("brand", message, data);
  }
  return sonnerToast(message, data);
}

export const toast = Object.assign(baseToast, {
  success: (message: ToastMessage, data?: ExternalToast) =>
    pushLiquid("success", message, data),
  error: (message: ToastMessage, data?: ExternalToast) =>
    pushLiquid("error", message, data),
  warning: (message: ToastMessage, data?: ExternalToast) =>
    pushLiquid("warning", message, data),
  info: (message: ToastMessage, data?: ExternalToast) =>
    pushLiquid("info", message, data),
  message: (message: ToastMessage, data?: ExternalToast) =>
    pushLiquid("brand", message, data),
  loading: sonnerToast.loading,
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,
  getHistory: sonnerToast.getHistory,
  getToasts: sonnerToast.getToasts,
}) as typeof sonnerToast;
