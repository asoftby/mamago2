import "server-only";

import type {
  NotificationScenario,
  RenderedNotificationContent,
  SendNotificationContext,
} from "@/lib/notifications/domainContracts";
import { renderNotificationContentCore } from "./notification-renderer-core";

export function renderNotificationContent(
  scenario: NotificationScenario,
  context: SendNotificationContext,
): RenderedNotificationContent {
  return renderNotificationContentCore(scenario, context);
}
