"use client";

import { useState } from "react";
import { RequisitesEmptyState } from "@/components/business/billing/RequisitesEmptyState";
import { RequisitesCard } from "@/components/business/billing/RequisitesCard";
import { RequisitesEditModal } from "@/components/business/billing/RequisitesEditModal";
import type { BillingProfile, BillingProfileFormData } from "@/types/billing";
import { mockBillingProfile } from "@/services/billing/mock";

export default function BillingRequisitesPage() {
  // TODO: Fetch real billing profile from database when backend is ready
  // For now, use mock data (returns null = empty state)
  const [profile, setProfile] = useState<BillingProfile | null>(
    mockBillingProfile()
  );
  const [showEditModal, setShowEditModal] = useState(false);

  const handleFillRequisites = () => {
    setShowEditModal(true);
  };

  const handleSaveRequisites = (data: BillingProfileFormData) => {
    // TODO: Save to database when backend is ready
    console.log("Saving requisites:", data);

    // For now, create a mock profile
    const newProfile: BillingProfile = {
      id: "mock-profile-1",
      businessId: "mock-business-1",
      ...data,
      completeness: "complete", // TODO: Calculate based on filled fields
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setProfile(newProfile);
    setShowEditModal(false);
  };

  return (
    <div>
      {profile ? (
        <RequisitesCard
          profile={profile}
          onEdit={() => setShowEditModal(true)}
        />
      ) : (
        <RequisitesEmptyState onFillRequisites={handleFillRequisites} />
      )}

      {showEditModal && (
        <RequisitesEditModal
          profile={profile || undefined}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveRequisites}
        />
      )}
    </div>
  );
}
