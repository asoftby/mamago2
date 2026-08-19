/**
 * Worker runtime context (§21 Step 2, Phase G).
 * Explicit, testable lifecycle: create once at process start, dispose once
 * at shutdown. `workerStartedAt` is DB time (not process wall-clock) so
 * Step 3's future detector-stale grace logic never inherits container
 * clock skew.
 */
import { PrismaClient } from "@prisma/client";

import { getDbNow } from "@/server/ops/dbTime";
import { GlobalLock } from "@/server/ops/lock/GlobalLock";
import { resolveWorkerId } from "./workerId";

export interface WorkerContext {
  workerId: string;
  workerStartedAt: Date;
  prisma: PrismaClient;
  lock: GlobalLock;
}

export async function createWorkerContext(databaseUrl: string): Promise<WorkerContext> {
  const workerId = resolveWorkerId();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const lock = new GlobalLock(databaseUrl);
  await lock.connect();
  const workerStartedAt = await getDbNow(prisma);

  return { workerId, workerStartedAt, prisma, lock };
}

export async function disposeWorkerContext(ctx: WorkerContext): Promise<void> {
  await ctx.prisma.$disconnect();
  await ctx.lock.close();
}
