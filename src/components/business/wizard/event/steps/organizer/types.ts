// Organizer Step Types

export interface OrganizerData {
  mode: "business" | "existing" | "custom";
  id: string | null;
  name: string;
  description: string;
  phone: string;
  website: string;
  logoUrl: string | null;
}

export interface ExistingOrganizer {
  id: string;
  name: string;
  description?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  isVerified: boolean;
}

export interface BusinessProfile {
  id: string;
  name: string;
  description?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
}

export interface UserRole {
  role: "BUSINESS_OWNER" | "ADMIN" | "MODERATOR";
  business?: BusinessProfile;
}