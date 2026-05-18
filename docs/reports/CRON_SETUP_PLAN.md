# Cron Setup Plan — Notification Scheduled Jobs

**Date**: May 12, 2026  
**Scope**: Setup options for stale booking job and retry job

---

## Overview

Two scheduled jobs need to run in production:

1. **Stale Booking Job** — Detects stale bookings and sends notifications
   - Runs every 1 hour
   - Function: `runBookingStaleNotificationJobSilent()`
   - Location: `src/server/jobs/bookingStale.job.ts`

2. **Retry Job** — Retries failed deliveries with exponential backoff
   - Runs every 5 minutes
   - Function: `retryFailedDelivery()`
   - Location: `src/server/services/notificationDelivery.service.ts`

---

## Option 1: Node-Cron (Recommended for MVP)

### Setup

**Installation**:
```bash
pnpm add node-cron
```

**Implementation**:

Create `src/server/jobs/scheduler.ts`:
```typescript
import cron from "node-cron";
import prisma from "@/lib/prisma";
import { runBookingStaleNotificationJobSilent } from "./bookingStale.job";
import { retryFailedDelivery } from "@/server/services/notificationDelivery.service";

/**
 * Initialize scheduled jobs.
 * Call this once on server startup.
 */
export function initializeScheduledJobs() {
  console.log("[scheduler] Initializing scheduled jobs");

  // Stale booking job: every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    console.log("[scheduler] Running stale booking job");
    try {
      await runBookingStaleNotificationJobSilent();
    } catch (err) {
      console.error("[scheduler] Stale booking job failed:", err);
    }
  });

  // Retry job: every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    console.log("[scheduler] Running retry job");
    try {
      const failed = await prisma.notificationDelivery.findMany({
        where: { status: "FAILED", attemptCount: { lt: 3 } },
        take: 100,
      });

      if (failed.length === 0) {
        console.log("[scheduler] No failed deliveries to retry");
        return;
      }

      console.log(`[scheduler] Retrying ${failed.length} failed deliveries`);
      let retried = 0;
      let succeeded = 0;

      for (const delivery of failed) {
        retried++;
        const success = await retryFailedDelivery(delivery.id);
        if (success) succeeded++;
      }

      console.log(`[scheduler] Retry job completed: ${succeeded}/${retried} succeeded`);
    } catch (err) {
      console.error("[scheduler] Retry job failed:", err);
    }
  });

  console.log("[scheduler] Scheduled jobs initialized");
}
```

**Integration**:

In your server startup file (e.g., `src/server/index.ts` or `src/app/layout.tsx`):
```typescript
import { initializeScheduledJobs } from "@/server/jobs/scheduler";

// Call once on server startup
if (process.env.NODE_ENV === "production" || process.env.ENABLE_CRON === "true") {
  initializeScheduledJobs();
}
```

### Pros

- ✅ Simple to set up
- ✅ No external dependencies
- ✅ Works in development and production
- ✅ Easy to debug
- ✅ No infrastructure needed

### Cons

- ❌ Only works in single-process mode
- ❌ Jobs lost if process restarts
- ❌ No persistence
- ❌ Not suitable for distributed systems

### When to Use

- MVP/early stage
- Single-process deployment
- Low volume of notifications
- Simple infrastructure

---

## Option 2: Bull/BullMQ (Recommended for Scale)

### Setup

**Installation**:
```bash
pnpm add bull redis
```

**Implementation**:

Create `src/server/jobs/queues.ts`:
```typescript
import Bull from "bull";
import { runBookingStaleNotificationJob } from "./bookingStale.job";
import { retryFailedDelivery } from "@/server/services/notificationDelivery.service";
import prisma from "@/lib/prisma";

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

// Stale booking queue
export const staleBookingQueue = new Bull("stale-bookings", redisConfig);

// Retry queue
export const retryQueue = new Bull("retry-deliveries", redisConfig);

// Process stale booking jobs
staleBookingQueue.process(async () => {
  console.log("[queue] Processing stale booking job");
  const result = await runBookingStaleNotificationJob();
  console.log("[queue] Stale booking job completed:", result);
  return result;
});

// Process retry jobs
retryQueue.process(async () => {
  console.log("[queue] Processing retry job");
  const failed = await prisma.notificationDelivery.findMany({
    where: { status: "FAILED", attemptCount: { lt: 3 } },
    take: 100,
  });

  if (failed.length === 0) {
    console.log("[queue] No failed deliveries to retry");
    return { retried: 0, succeeded: 0 };
  }

  console.log(`[queue] Retrying ${failed.length} failed deliveries`);
  let succeeded = 0;

  for (const delivery of failed) {
    const success = await retryFailedDelivery(delivery.id);
    if (success) succeeded++;
  }

  console.log(`[queue] Retry job completed: ${succeeded}/${failed.length} succeeded`);
  return { retried: failed.length, succeeded };
});

// Error handlers
staleBookingQueue.on("failed", (job, err) => {
  console.error("[queue] Stale booking job failed:", job.id, err);
});

retryQueue.on("failed", (job, err) => {
  console.error("[queue] Retry job failed:", job.id, err);
});

/**
 * Initialize scheduled jobs.
 * Call this once on server startup.
 */
export async function initializeScheduledJobs() {
  console.log("[queue] Initializing scheduled jobs");

  // Schedule stale booking job: every hour at minute 0
  await staleBookingQueue.add({}, {
    repeat: { cron: "0 * * * *" },
    removeOnComplete: true,
  });

  // Schedule retry job: every 5 minutes
  await retryQueue.add({}, {
    repeat: { cron: "*/5 * * * *" },
    removeOnComplete: true,
  });

  console.log("[queue] Scheduled jobs initialized");
}
```

**Integration**:

In your server startup file:
```typescript
import { initializeScheduledJobs } from "@/server/jobs/queues";

// Call once on server startup
if (process.env.NODE_ENV === "production") {
  await initializeScheduledJobs();
}
```

**Environment Variables**:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Pros

- ✅ Distributed and reliable
- ✅ Persistent job storage
- ✅ Automatic retries
- ✅ Job monitoring and dashboards
- ✅ Suitable for scale
- ✅ Works with multiple processes

### Cons

- ❌ Requires Redis
- ❌ More complex setup
- ❌ Additional infrastructure
- ❌ Harder to debug

### When to Use

- Production at scale
- Multiple processes/servers
- High volume of notifications
- Need for job persistence
- Distributed systems

---

## Option 3: AWS Lambda (Serverless)

### Setup

**Lambda Function**:

Create `src/server/jobs/lambda.ts`:
```typescript
import { runBookingStaleNotificationJob } from "./bookingStale.job";
import { retryFailedDelivery } from "@/server/services/notificationDelivery.service";
import prisma from "@/lib/prisma";

export async function staleBookingHandler() {
  console.log("[lambda] Running stale booking job");
  try {
    const result = await runBookingStaleNotificationJob();
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("[lambda] Stale booking job failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Job failed" }),
    };
  }
}

export async function retryHandler() {
  console.log("[lambda] Running retry job");
  try {
    const failed = await prisma.notificationDelivery.findMany({
      where: { status: "FAILED", attemptCount: { lt: 3 } },
      take: 100,
    });

    if (failed.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ retried: 0, succeeded: 0 }),
      };
    }

    let succeeded = 0;
    for (const delivery of failed) {
      const success = await retryFailedDelivery(delivery.id);
      if (success) succeeded++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ retried: failed.length, succeeded }),
    };
  } catch (err) {
    console.error("[lambda] Retry job failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Job failed" }),
    };
  }
}
```

**CloudWatch Events Rules**:

1. Stale booking job:
   - Schedule: `cron(0 * * * ? *)` (every hour)
   - Target: Lambda function `staleBookingHandler`

2. Retry job:
   - Schedule: `cron(*/5 * * * ? *)` (every 5 minutes)
   - Target: Lambda function `retryHandler`

### Pros

- ✅ Serverless (no infrastructure)
- ✅ Automatic scaling
- ✅ Pay per execution
- ✅ Built-in monitoring
- ✅ No maintenance

### Cons

- ❌ Cold start latency
- ❌ AWS-specific
- ❌ Requires AWS account
- ❌ More expensive at scale

### When to Use

- Serverless architecture
- AWS-based infrastructure
- Low to medium volume
- Want minimal ops overhead

---

## Option 4: Google Cloud Scheduler (Serverless)

### Setup

**Cloud Function**:

```typescript
import { runBookingStaleNotificationJob } from "./bookingStale.job";
import { retryFailedDelivery } from "@/server/services/notificationDelivery.service";
import prisma from "@/lib/prisma";

export async function staleBookingJob(req, res) {
  try {
    const result = await runBookingStaleNotificationJob();
    res.status(200).json(result);
  } catch (err) {
    console.error("Stale booking job failed:", err);
    res.status(500).json({ error: "Job failed" });
  }
}

export async function retryJob(req, res) {
  try {
    const failed = await prisma.notificationDelivery.findMany({
      where: { status: "FAILED", attemptCount: { lt: 3 } },
      take: 100,
    });

    let succeeded = 0;
    for (const delivery of failed) {
      const success = await retryFailedDelivery(delivery.id);
      if (success) succeeded++;
    }

    res.status(200).json({ retried: failed.length, succeeded });
  } catch (err) {
    console.error("Retry job failed:", err);
    res.status(500).json({ error: "Job failed" });
  }
}
```

**Cloud Scheduler Jobs**:

1. Stale booking job:
   - Frequency: `0 * * * *` (every hour)
   - Target: Cloud Function `staleBookingJob`

2. Retry job:
   - Frequency: `*/5 * * * *` (every 5 minutes)
   - Target: Cloud Function `retryJob`

### Pros

- ✅ Serverless
- ✅ Simple setup
- ✅ Google Cloud integration
- ✅ Automatic scaling

### Cons

- ❌ Google Cloud-specific
- ❌ Requires Google Cloud account
- ❌ Cold start latency

---

## Recommendation

### For MVP (Current Phase)

**Use Option 1: Node-Cron**

- Simple to implement
- No external dependencies
- Works in development and production
- Easy to debug
- Can migrate to Bull/BullMQ later

### For Production at Scale

**Use Option 2: Bull/BullMQ**

- Reliable and persistent
- Distributed job processing
- Better monitoring
- Suitable for high volume

### For Serverless Architecture

**Use Option 3 or 4: AWS Lambda or Google Cloud Scheduler**

- No infrastructure management
- Automatic scaling
- Pay per execution

---

## Implementation Timeline

### Phase 2J (Current)

- ✅ Jobs are ready to be integrated
- ✅ Documentation complete
- ⏳ Choose cron option

### Phase 2K (Next)

- [ ] Implement chosen cron option
- [ ] Set up monitoring
- [ ] Test in staging
- [ ] Deploy to production

---

## Monitoring

### Node-Cron

```typescript
// Add to scheduler.ts
cron.schedule("0 * * * *", async () => {
  const startTime = Date.now();
  try {
    await runBookingStaleNotificationJobSilent();
    const duration = Date.now() - startTime;
    console.log(`[scheduler] Stale booking job completed in ${duration}ms`);
  } catch (err) {
    console.error("[scheduler] Stale booking job failed:", err);
    // Send alert to monitoring service
  }
});
```

### Bull/BullMQ

```typescript
// Built-in monitoring
staleBookingQueue.on("completed", (job, result) => {
  console.log(`[queue] Job ${job.id} completed:`, result);
});

staleBookingQueue.on("failed", (job, err) => {
  console.error(`[queue] Job ${job.id} failed:`, err);
  // Send alert to monitoring service
});
```

---

## Troubleshooting

### Job Not Running

**Node-Cron**:
- Check if process is running
- Check logs for errors
- Verify cron expression is correct

**Bull/BullMQ**:
- Check if Redis is running
- Check if queue is processing
- Check Bull dashboard

### Job Running Too Frequently

- Check cron expression
- Verify job duration
- Check for duplicate schedules

### Job Failing

- Check logs for error message
- Verify database connection
- Check for missing environment variables
- Verify Telegram/email configuration

---

## Summary

**Recommended**: Option 1 (Node-Cron) for MVP

**Setup time**: 30 minutes

**Complexity**: Low

**Next steps**:
1. Choose cron option
2. Implement in Phase 2K
3. Test in staging
4. Deploy to production
