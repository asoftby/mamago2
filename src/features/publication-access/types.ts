import type { LucideIcon } from "lucide-react";

export type PublicationEntityType = "event" | "offer" | "place" | "route";

export type PublicationAccessMethod =
  | "details"
  | "ticket"
  | "timeslots"
  | "prebooking"
  | "request"
  | "external"
  | "contact";

export type PublicationAccessTimeSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  capacity?: number | null;
};

export type PublicationAccess = {
  method: PublicationAccessMethod;
  /** Event prebooking: default to mamaGo; legacy phone/link are explicit external actions. */
  prebookingChannel?: "internal" | "phone" | "link";
  ticketUrl?: string;
  externalUrl?: string;
  phone?: string;
  instructions?: string;
  timeSlots?: PublicationAccessTimeSlot[];
};

export type PublicationAccessMethodConfig = {
  icon: LucideIcon;
  title: string;
  description: string;
  publicButtonLabel: string;
  requiresUrl?: boolean;
  requiresPhone?: boolean;
  supportsTimeSlots?: boolean;
  urlField?: "ticketUrl" | "externalUrl";
  supportsPhone?: boolean;
  supportsExternalUrl?: boolean;
};

export type PublicationAccessLabels = {
  sectionTitle: string;
  sectionDescription: string;
  previewTitle: string;
  instructionsLabel: string;
};

