/**
 * @deprecated Compatibility adapter for older business notification UI imports.
 *
 * The canonical notification settings taxonomy now lives in
 * `settingsDomain.ts`. There are no current in-repo callers, but this file is
 * kept as a low-risk compatibility shim until the final removal is explicitly approved.
 */

import type { NotificationType } from "@prisma/client";
import {
  getNotificationSettingsGroupDefinitions,
  getNotificationSettingsLabel,
  getNotificationSettingsTypeDefinitions,
} from "./settingsDomain";

const BUSINESS_DEFINITIONS = getNotificationSettingsTypeDefinitions("BUSINESS");

export const BUSINESS_NOTIFICATION_SETTINGS_GROUPS = getNotificationSettingsGroupDefinitions(
  "BUSINESS",
).map((group) => ({
  title: group.title,
  types: BUSINESS_DEFINITIONS
    .filter((definition) => definition.groupId === group.id)
    .map((definition) => definition.type),
}));

export const BUSINESS_NOTIFICATION_SETTINGS_TYPES = BUSINESS_DEFINITIONS.map(
  (definition) => definition.type,
);

export const BUSINESS_NOTIFICATION_TYPE_LABELS = BUSINESS_DEFINITIONS.reduce(
  (accumulator, definition) => {
    accumulator[definition.type] = getNotificationSettingsLabel(definition.type);
    return accumulator;
  },
  {} as Record<NotificationType, string>,
);
