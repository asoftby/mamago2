 
/**
 * Commercial Access Service - Enforcement Layer
 * 
 * Central service for evaluating and enforcing commercial access rules.
 * This is the single source of truth for what a business can do commercially.
 * 
 * IMPORTANT: This is NOT billing. This is commercial relationship enforcement.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";

/**
 * Effective commercial status of a business
 */
export type EffectiveCommercialStatus =
  | "FULL_ACCESS"        // Contract active, placement active, all features available
  | "GRACE_ACCESS"       // In grace period, limited features
  | "LIMITED_ACCESS"     // Some restrictions due to expiring items
  | "EXPIRED_ACCESS"     // Placement expired, premium features disabled
  | "CONTRACT_BLOCKED"   // Contract expired/terminated, commercial activation blocked
  | "PAUSED_ACCESS";     // Placement paused by admin

/**
 * Commercial feature capabilities
 */
export type CommercialFeature =
  | "LEAD_ACCESS"          // Can receive paid leads
  | "STORIES"              // Can publish stories
  | "PRIORITY_BOOST"       // Priority in search results
  | "PROMO_PLACEMENT"      // Promo slots on homepage
  | "PREMIUM_BADGE"        // Premium badge display
  | "PAID_REQUESTS"        // Can receive paid requests
  | "PREMIUM_VISIBILITY"   // Enhanced catalog visibility
  | "ANALYTICS"            // Access to analytics
  | "COMMERCIAL_ACTIVATION"; // Can activate new commercial features

/**
 * Business Commercial Access Snapshot
 * 
 * Complete picture of business's current commercial state and capabilities
 */
export interface BusinessCommercialAccessSnapshot {
  businessId: string;
  businessName: string;
  
  // Contract state
  hasActiveContract: boolean;
  contractStatus: string | null;
  contractEndsAt: Date | null;
  contractExpired: boolean;
  
  // Placement state
  hasActivePlacement: boolean;
  placementStatus: string | null;
  placementEndsAt: Date | null;
  placementExpired: boolean;
  placementPlanName: string | null;
  
  // Grace period
  isInGracePeriod: boolean;
  graceUntil: Date | null;
  graceDaysRemaining: number | null;
  
  // Effective status
  effectiveStatus: EffectiveCommercialStatus;
  effectiveStatusLabel: string;
  effectiveStatusDescription: string;
  
  // Feature capabilities
  enabledFeatures: CommercialFeature[];
  disabledFeatures: CommercialFeature[];
  
  // Service placements
  activeServicePlacements: Array<{
    id: string;
    entityType: string;
    notes: string | null;
    endsAt: Date;
  }>;
  
  // Warnings and restrictions
  warnings: string[];
  restrictions: string[];
  reasons: string[];
  
  // Computed at
  computedAt: Date;
}

/**
 * Get complete commercial access snapshot for a business
 */
export async function getBusinessCommercialAccessSnapshot(
  businessId: string
): Promise<BusinessCommercialAccessSnapshot> {
  const now = new Date();
  
  // Fetch all commercial data
  const [business, contract, placement, servicePlacements] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    }),
    prisma.businessContract.findFirst({
      where: { businessId },
      orderBy: { endsAt: "desc" },
    }),
    prisma.businessPlacement.findFirst({
      where: { businessId },
      orderBy: { endsAt: "desc" },
      include: {
        plan: {
          select: {
            name: true,
            hasPriorityBoost: true,
            hasLeadAccess: true,
            hasAnalytics: true,
            storiesPerMonth: true,
          },
        },
      },
    }),
    prisma.businessServicePlacement.findMany({
      where: {
        businessId,
        status: { in: ["ACTIVE", "EXPIRING"] },
      },
      select: {
        id: true,
        entityType: true,
        notes: true,
        endsAt: true,
      },
    }),
  ]);

  if (!business) {
    throw new Error(`Business ${businessId} not found`);
  }

  // Evaluate contract state
  const hasActiveContract = contract?.status === "ACTIVE" || contract?.status === "EXPIRING";
  const contractExpired = contract?.status === "EXPIRED" || contract?.status === "TERMINATED";
  
  // Evaluate placement state
  const hasActivePlacement = placement?.status === "ACTIVE" || placement?.status === "EXPIRING";
  const placementExpired = placement?.status === "EXPIRED";
  const placementPaused = placement?.status === "PAUSED";
  
  // Evaluate grace period
  const isInGracePeriod = placement?.graceUntil ? placement.graceUntil > now : false;
  const graceDaysRemaining = isInGracePeriod && placement?.graceUntil
    ? Math.ceil((placement.graceUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  // Determine effective status
  const effectiveStatus = determineEffectiveStatus({
    hasActiveContract,
    contractExpired,
    hasActivePlacement,
    placementExpired,
    placementPaused,
    isInGracePeriod,
  });
  
  // Determine enabled features
  const enabledFeatures = determineEnabledFeatures({
    effectiveStatus,
    placement,
    servicePlacements,
  });
  
  // All possible features
  const allFeatures: CommercialFeature[] = [
    "LEAD_ACCESS",
    "STORIES",
    "PRIORITY_BOOST",
    "PROMO_PLACEMENT",
    "PREMIUM_BADGE",
    "PAID_REQUESTS",
    "PREMIUM_VISIBILITY",
    "ANALYTICS",
    "COMMERCIAL_ACTIVATION",
  ];
  
  const disabledFeatures = allFeatures.filter(f => !enabledFeatures.includes(f));
  
  // Generate warnings and restrictions
  const warnings = generateWarnings({
    contract,
    placement,
    servicePlacements,
    isInGracePeriod,
    now,
  });
  
  const restrictions = generateRestrictions({
    effectiveStatus,
    disabledFeatures,
  });
  
  const reasons = generateReasons({
    contractExpired,
    placementExpired,
    placementPaused,
    isInGracePeriod,
  });
  
  return {
    businessId: business.id,
    businessName: business.name,
    
    hasActiveContract,
    contractStatus: contract?.status || null,
    contractEndsAt: contract?.endsAt || null,
    contractExpired,
    
    hasActivePlacement,
    placementStatus: placement?.status || null,
    placementEndsAt: placement?.endsAt || null,
    placementExpired,
    placementPlanName: placement?.plan?.name || null,
    
    isInGracePeriod,
    graceUntil: placement?.graceUntil || null,
    graceDaysRemaining,
    
    effectiveStatus,
    effectiveStatusLabel: getEffectiveStatusLabel(effectiveStatus),
    effectiveStatusDescription: getEffectiveStatusDescription(effectiveStatus),
    
    enabledFeatures,
    disabledFeatures,
    
    activeServicePlacements: servicePlacements,
    
    warnings,
    restrictions,
    reasons,
    
    computedAt: now,
  };
}

/**
 * Check if business can use a specific feature
 */
export async function canBusinessUseFeature(
  businessId: string,
  feature: CommercialFeature
): Promise<boolean> {
  const snapshot = await getBusinessCommercialAccessSnapshot(businessId);
  return snapshot.enabledFeatures.includes(feature);
}

/**
 * Get all feature capabilities for a business
 */
export async function getBusinessFeatureCapabilities(businessId: string) {
  const snapshot = await getBusinessCommercialAccessSnapshot(businessId);
  
  return {
    canUseLeadAccess: snapshot.enabledFeatures.includes("LEAD_ACCESS"),
    canPublishStories: snapshot.enabledFeatures.includes("STORIES"),
    canUsePriorityBoost: snapshot.enabledFeatures.includes("PRIORITY_BOOST"),
    canUsePromoPlacement: snapshot.enabledFeatures.includes("PROMO_PLACEMENT"),
    canUsePremiumBadge: snapshot.enabledFeatures.includes("PREMIUM_BADGE"),
    canReceivePaidRequests: snapshot.enabledFeatures.includes("PAID_REQUESTS"),
    canAppearAsPremiumBusiness: snapshot.enabledFeatures.includes("PREMIUM_VISIBILITY"),
    canUseAnalytics: snapshot.enabledFeatures.includes("ANALYTICS"),
    canActivateNewCommercialFeature: snapshot.enabledFeatures.includes("COMMERCIAL_ACTIVATION"),
  };
}

/**
 * Determine effective commercial status based on contract and placement state
 */
function determineEffectiveStatus(state: {
  hasActiveContract: boolean;
  contractExpired: boolean;
  hasActivePlacement: boolean;
  placementExpired: boolean;
  placementPaused: boolean;
  isInGracePeriod: boolean;
}): EffectiveCommercialStatus {
  // Contract terminated/expired blocks everything
  if (state.contractExpired) {
    return "CONTRACT_BLOCKED";
  }
  
  // Placement paused
  if (state.placementPaused) {
    return "PAUSED_ACCESS";
  }
  
  // Placement expired but in grace period
  if (state.placementExpired && state.isInGracePeriod) {
    return "GRACE_ACCESS";
  }
  
  // Placement expired, no grace
  if (state.placementExpired) {
    return "EXPIRED_ACCESS";
  }
  
  // Has active contract and placement
  if (state.hasActiveContract && state.hasActivePlacement) {
    return "FULL_ACCESS";
  }
  
  // Has contract but no placement
  if (state.hasActiveContract && !state.hasActivePlacement) {
    return "LIMITED_ACCESS";
  }
  
  // Default to limited
  return "LIMITED_ACCESS";
}

/**
 * Determine which features are enabled based on effective status
 */
function determineEnabledFeatures(context: {
  effectiveStatus: EffectiveCommercialStatus;
  placement: any;
  servicePlacements: any[];
}): CommercialFeature[] {
  const features: CommercialFeature[] = [];
  
  switch (context.effectiveStatus) {
    case "FULL_ACCESS":
      // All features from plan
      if (context.placement?.plan?.hasLeadAccess) {
        features.push("LEAD_ACCESS", "PAID_REQUESTS");
      }
      if (context.placement?.plan?.storiesPerMonth > 0) {
        features.push("STORIES");
      }
      if (context.placement?.plan?.hasPriorityBoost) {
        features.push("PRIORITY_BOOST");
      }
      if (context.placement?.plan?.hasAnalytics) {
        features.push("ANALYTICS");
      }
      features.push("PREMIUM_BADGE", "PREMIUM_VISIBILITY", "COMMERCIAL_ACTIVATION");
      
      // Service placements
      if (context.servicePlacements.some(sp => sp.entityType === "PROMO")) {
        features.push("PROMO_PLACEMENT");
      }
      break;
      
    case "GRACE_ACCESS":
      // Limited features during grace
      features.push("PREMIUM_VISIBILITY"); // Keep visible
      // No new commercial activations
      // No premium features
      break;
      
    case "LIMITED_ACCESS":
      // Very limited
      features.push("PREMIUM_VISIBILITY"); // Basic visibility
      break;
      
    case "EXPIRED_ACCESS":
    case "CONTRACT_BLOCKED":
    case "PAUSED_ACCESS":
      // No premium features
      break;
  }
  
  return features;
}

/**
 * Generate warnings for business
 */
function generateWarnings(context: {
  contract: any;
  placement: any;
  servicePlacements: any[];
  isInGracePeriod: boolean;
  now: Date;
}): string[] {
  const warnings: string[] = [];
  
  if (context.contract?.status === "EXPIRING") {
    const daysUntilEnd = Math.ceil(
      (context.contract.endsAt.getTime() - context.now.getTime()) / (1000 * 60 * 60 * 24)
    );
    warnings.push(`Договор истекает через ${daysUntilEnd} дн.`);
  }
  
  if (context.placement?.status === "EXPIRING") {
    const daysUntilEnd = Math.ceil(
      (context.placement.endsAt.getTime() - context.now.getTime()) / (1000 * 60 * 60 * 24)
    );
    warnings.push(`Размещение заканчивается через ${daysUntilEnd} дн.`);
  }
  
  if (context.isInGracePeriod && context.placement?.graceUntil) {
    const graceDays = Math.ceil(
      (context.placement.graceUntil.getTime() - context.now.getTime()) / (1000 * 60 * 60 * 24)
    );
    warnings.push(`Grace период активен (${graceDays} дн. осталось)`);
  }
  
  context.servicePlacements.forEach(sp => {
    if (sp.endsAt) {
      const daysUntilEnd = Math.ceil(
        (sp.endsAt.getTime() - context.now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilEnd <= 7) {
        warnings.push(`${sp.entityType} заканчивается через ${daysUntilEnd} дн.`);
      }
    }
  });
  
  return warnings;
}

/**
 * Generate restrictions explanation
 */
function generateRestrictions(context: {
  effectiveStatus: EffectiveCommercialStatus;
  disabledFeatures: CommercialFeature[];
}): string[] {
  const restrictions: string[] = [];
  
  if (context.disabledFeatures.includes("LEAD_ACCESS")) {
    restrictions.push("Прием платных лидов недоступен");
  }
  if (context.disabledFeatures.includes("STORIES")) {
    restrictions.push("Публикация stories недоступна");
  }
  if (context.disabledFeatures.includes("PRIORITY_BOOST")) {
    restrictions.push("Приоритет в выдаче отключен");
  }
  if (context.disabledFeatures.includes("COMMERCIAL_ACTIVATION")) {
    restrictions.push("Активация новых коммерческих услуг заблокирована");
  }
  
  return restrictions;
}

/**
 * Generate reasons for current state
 */
function generateReasons(context: {
  contractExpired: boolean;
  placementExpired: boolean;
  placementPaused: boolean;
  isInGracePeriod: boolean;
}): string[] {
  const reasons: string[] = [];
  
  if (context.contractExpired) {
    reasons.push("Договор истек");
  }
  if (context.placementExpired && !context.isInGracePeriod) {
    reasons.push("Размещение завершено");
  }
  if (context.placementPaused) {
    reasons.push("Размещение приостановлено администратором");
  }
  if (context.isInGracePeriod) {
    reasons.push("Действует grace период");
  }
  
  return reasons;
}

/**
 * Get human-readable label for effective status
 */
function getEffectiveStatusLabel(status: EffectiveCommercialStatus): string {
  const labels: Record<EffectiveCommercialStatus, string> = {
    FULL_ACCESS: "Полный доступ",
    GRACE_ACCESS: "Grace период",
    LIMITED_ACCESS: "Ограниченный доступ",
    EXPIRED_ACCESS: "Доступ истек",
    CONTRACT_BLOCKED: "Заблокировано договором",
    PAUSED_ACCESS: "Приостановлено",
  };
  return labels[status];
}

/**
 * Get human-readable description for effective status
 */
function getEffectiveStatusDescription(status: EffectiveCommercialStatus): string {
  const descriptions: Record<EffectiveCommercialStatus, string> = {
    FULL_ACCESS: "Все коммерческие возможности доступны",
    GRACE_ACCESS: "Временный доступ с ограничениями",
    LIMITED_ACCESS: "Доступны только базовые функции",
    EXPIRED_ACCESS: "Премиум-функции отключены",
    CONTRACT_BLOCKED: "Коммерческая активация заблокирована",
    PAUSED_ACCESS: "Доступ временно приостановлен",
  };
  return descriptions[status];
}
