export type ActivationEmailDeliveryResult =
  | { status: "DELIVERY_DISABLED" }
  | { status: "DELIVERY_ALLOWED" };

export type ActivationEmailEnvironment = {
  nodeEnv: string | undefined;
  appEnvironment: string | undefined;
  productionEnabled: string | undefined;
  productionApproved: string | undefined;
};

export type ActivationEmailApprovalMode = "SELF_SERVICE" | "PRODUCTION_BATCH";

export type ActivationEmailBlockReason = "ENVIRONMENT" | "KILL_SWITCH";

function currentEnvironment(): ActivationEmailEnvironment {
  return {
    nodeEnv: process.env.NODE_ENV,
    appEnvironment: process.env.APP_ENV,
    productionEnabled: process.env.MIGRATED_USER_ACTIVATION_EMAIL_ENABLED,
    productionApproved: process.env.MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED,
  };
}

/**
 * LOCAL/DEV are always blocked. The two explicit migrated-user approval flags
 * protect only bulk production delivery; user-initiated activation requests
 * (login/manual self-service) must not be disabled by the bulk-send kill
 * switch.
 */
export function classifyActivationEmailBlock(
  environment = currentEnvironment(),
  approvalMode: ActivationEmailApprovalMode = "PRODUCTION_BATCH",
): ActivationEmailBlockReason | null {
  if (environment.nodeEnv !== "production" || environment.appEnvironment !== "production") {
    return "ENVIRONMENT";
  }
  if (
    approvalMode === "PRODUCTION_BATCH" &&
    (environment.productionEnabled !== "true" || environment.productionApproved !== "true")
  ) {
    return "KILL_SWITCH";
  }
  return null;
}

export function resolveActivationEmailDelivery(
  environment = currentEnvironment(),
  approvalMode: ActivationEmailApprovalMode = "PRODUCTION_BATCH",
): ActivationEmailDeliveryResult {
  if (classifyActivationEmailBlock(environment, approvalMode) !== null) {
    return { status: "DELIVERY_DISABLED" };
  }
  // Provider itself lives in activationEmailDelivery.ts (deliverMigratedAccountActivationEmail);
  // this gate only ever decides whether that provider call is reachable at all.
  return { status: "DELIVERY_ALLOWED" };
}
