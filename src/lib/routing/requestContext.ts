import { headers } from "next/headers";

export interface RequestRoutingContext {
  currentHost?: string;
  currentProtocol?: string;
}

export async function getCurrentRequestRoutingContext(): Promise<RequestRoutingContext> {
  const headerStore = await headers();

  return {
    currentHost: headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? undefined,
    currentProtocol: headerStore.get("x-forwarded-proto") ?? undefined,
  };
}
