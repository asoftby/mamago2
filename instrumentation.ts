export async function register() {
  const { assertProductionSeoEnv } = await import("@/lib/config/productionEnvGuard");
  assertProductionSeoEnv();
}
