"use client";

import * as React from "react";
import type { Action, ExternalToast, ToastT } from "sonner";
import { toast as sonnerToast } from "sonner";
import {
  LiquidNotification,
  type LiquidNotificationVariant,
} from "@/components/ui/liquid-notification";

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
  if (data.action && isAction(data.action)) {
    return {
      label: String(data.action.label),
      run: () => {
        const ev = {
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new MouseEvent("click"),
        } as unknown as React.MouseEvent<HTMLButtonElement>;
        data.action!.onClick!(ev);
      },
    };
  }
  if (data.cancel && isAction(data.cancel)) {
    return {
      label: String(data.cancel.label),
      run: () => {
        const ev = {
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new MouseEvent("click"),
        } as unknown as React.MouseEvent<HTMLButtonElement>;
        data.cancel!.onClick!(ev);
      },
    };
  }
  return undefined;
}

function isSimpleMessage(message: React.ReactNode): message is string | number {
  return typeof message === "string" || typeof message === "number";
}

function delegateNative(
  variant: LiquidNotificationVariant,
  message: React.ReactNode,
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
  message: React.ReactNode,
  data?: ExternalToast,
) {
  if (!isSimpleMessage(message)) {
    return delegateNative(variant, message, data);
  }

  const title = String(message);
  const description = asStringDescription(data?.description);
  const primary = pickPrimaryAction(data);
  const duration = data?.duration ?? 2500;

  return sonnerToast.custom(
    (id) => (
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
      id: data?.id,
      duration,
      onAutoClose: data?.onAutoClose,
    },
  );
}

function baseToast(message: React.ReactNode, data?: ExternalToast) {
  if (isSimpleMessage(message)) {
    return pushLiquid("brand", message, data);
  }
  return sonnerToast(message, data);
}

export const toast = Object.assign(baseToast, {
  success: (message: React.ReactNode, data?: ExternalToast) =>
    pushLiquid("success", message, data),
  error: (message: React.ReactNode, data?: ExternalToast) =>
    pushLiquid("error", message, data),
  warning: (message: React.ReactNode, data?: ExternalToast) =>
    pushLiquid("warning", message, data),
  info: (message: React.ReactNode, data?: ExternalToast) =>
    pushLiquid("info", message, data),
  message: (message: React.ReactNode, data?: ExternalToast) =>
    pushLiquid("brand", message, data),
  loading: sonnerToast.loading,
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,
  getHistory: sonnerToast.getHistory,
  getToasts: sonnerToast.getToasts,
});
