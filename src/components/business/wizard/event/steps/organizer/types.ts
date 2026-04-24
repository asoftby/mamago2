// Organizer Step Types

export interface OrganizerData {
  mode: "existing" | "import" | "manual";
  id: string | null;
  name: string;
  description?: string;
  unp?: string;
  phone: string;
  website: string;
  instagram: string;
  logoUrl?: string | null;
}

export interface ExistingOrganizer {
  id: string;
  name: string;
  description?: string;
  unp?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  logoUrl?: string;
  isVerified?: boolean;
  createdFrom?: "import" | "manual";
  linkedBusinessId?: string | null;
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
