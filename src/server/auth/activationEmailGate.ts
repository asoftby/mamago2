export type ActivationEmailDeliveryResult =
  | { status: "DELIVERY_DISABLED" }
  | { status: "DELIVERY_ALLOWED" };

export type ActivationEmailEnvironment = {
  nodeEnv: string | undefined;
  appEnvironment: string | undefined;
  productionEnabled: string | undefined;
  productionApproved: string | undefined;
};

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
 * Same decision as `resolveActivationEmailDelivery`, split into its two
 * distinct "why not" reasons — for delivery-audit persistence, which needs
 * to tell "wrong environment entirely" (`ENVIRONMENT`, e.g. LOCAL/DEV) apart
 * from "in production but the explicit approval flags are off"
 * (`KILL_SWITCH`). `null` means delivery is allowed.
 */
export function classifyActivationEmailBlock(
  environment = currentEnvironment(),
): ActivationEmailBlockReason | null {
  if (environment.nodeEnv !== "production" || environment.appEnvironment !== "production") {
    return "ENVIRONMENT";
  }
  if (environment.productionEnabled !== "true" || environment.productionApproved !== "true") {
    return "KILL_SWITCH";
  }
  return null;
}

export function resolveActivationEmailDelivery(
  environment = currentEnvironment(),
): ActivationEmailDeliveryResult {
  if (classifyActivationEmailBlock(environment) !== null) {
    return { status: "DELIVERY_DISABLED" };
  }
  // Provider itself lives in activationEmailDelivery.ts (deliverMigratedAccountActivationEmail);
  // this gate only ever decides whether that provider call is reachable at all.
  return { status: "DELIVERY_ALLOWED" };
}
