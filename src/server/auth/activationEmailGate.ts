export type ActivationEmailDeliveryResult =
  | { status: "DELIVERY_DISABLED" }
  | { status: "PROVIDER_UNAVAILABLE" };

export type ActivationEmailEnvironment = {
  nodeEnv: string | undefined;
  appEnvironment: string | undefined;
  productionEnabled: string | undefined;
  productionApproved: string | undefined;
};

function currentEnvironment(): ActivationEmailEnvironment {
  return {
    nodeEnv: process.env.NODE_ENV,
    appEnvironment: process.env.APP_ENV,
    productionEnabled: process.env.MIGRATED_USER_ACTIVATION_EMAIL_ENABLED,
    productionApproved: process.env.MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED,
  };
}

export function resolveActivationEmailDelivery(
  environment = currentEnvironment(),
): ActivationEmailDeliveryResult {
  const deliveryAllowed =
    environment.nodeEnv === "production" &&
    environment.appEnvironment === "production" &&
    environment.productionEnabled === "true" &&
    environment.productionApproved === "true";

  if (!deliveryAllowed) {
    return { status: "DELIVERY_DISABLED" };
  }
  // Provider connection is intentionally outside Slice 3.
  return { status: "PROVIDER_UNAVAILABLE" };
}
