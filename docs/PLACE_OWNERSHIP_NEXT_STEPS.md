# Place Ownership/Claim - Next Steps

## Статус: ✅ Аудит завершен

Дата: 2026-04-04

---

## Главный вывод

**Ownership уже реализовано в Place модели.** Нужна только интеграция существующего PlaceClaimRequest в admin UI.

### Текущее состояние:
- ✅ `ownerUserId` поле в Place
- ✅ PlaceClaimRequest модель
- ✅ `POST /api/business/places/[id]/claim` endpoint
- ✅ Access control через `canManageOwnedContent()`
- ❌ Admin endpoints для одобрения/отклонения claims
- ❌ Admin UI для управления claims
- ❌ Notifications для claim workflow

---

## Рекомендуемый план реализации

### Phase 1: Подготовка (1-2 часа)

#### 1.1 Добавить enum для PlaceClaimRequest.status

**Файл:** `prisma/schema.prisma`

```prisma
enum PlaceClaimRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model PlaceClaimRequest {
  id               String                    @id @default(cuid())
  placeId          String
  userId           String
  businessId       String?
  status           PlaceClaimRequestStatus   @default(PENDING)  // ← Changed from string
  note             String?
  reviewedAt       DateTime?
  reviewedByUserId String?

  place      Place @relation(fields: [placeId], references: [id], onDelete: Cascade)
  user       User  @relation(fields: [userId], references: [id], onDelete: Cascade, name: "ClaimRequester")
  reviewedBy User? @relation(fields: [reviewedByUserId], references: [id], onDelete: SetNull, name: "ClaimReviewer")

  createdAt DateTime @default(now())

  @@index([placeId, status])
  @@index([userId, createdAt])
  @@index([status])
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_place_claim_request_status_enum
```

#### 1.2 Создать claim service

**Файл:** `src/server/services/placeClaim.service.ts`

```typescript
/**
 * Place Claim Service
 * Handles claim requests for existing places
 * Server-only - do not import in client components
 */

import prisma from "@/lib/prisma";
import { PlaceClaimRequestStatus } from "@prisma/client";

/**
 * Get pending claim requests (for admin)
 */
export async function getPendingClaimRequests(limit = 50, offset = 0) {
  return prisma.placeClaimRequest.findMany({
    where: {
      status: "PENDING",
    },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          ownerUserId: true,
          owner: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    skip: offset,
  });
}

/**
 * Get claim request by ID
 */
export async function getClaimRequest(claimId: string) {
  return prisma.placeClaimRequest.findUnique({
    where: { id: claimId },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          ownerUserId: true,
          owner: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });
}

/**
 * Approve claim request - transfer ownership
 */
export async function approveClaimRequest(
  claimId: string,
  reviewedByUserId: string,
  note?: string
): Promise<void> {
  const claim = await prisma.placeClaimRequest.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      placeId: true,
      userId: true,
      status: true,
      place: {
        select: {
          id: true,
          title: true,
          ownerUserId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Claim request not found");
  }

  if (claim.status !== "PENDING") {
    throw new Error(`Cannot approve claim with status: ${claim.status}`);
  }

  // Transfer ownership
  await prisma.$transaction([
    // Update claim status
    prisma.placeClaimRequest.update({
      where: { id: claimId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId,
        note: note || null,
      },
    }),

    // Transfer place ownership
    prisma.place.update({
      where: { id: claim.placeId },
      data: {
        ownerUserId: claim.userId,
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: claim.placeId,
        action: "APPROVE",
        message: `Claim approved: ownership transferred from ${claim.place.ownerUserId} to ${claim.userId}`,
        reviewedByUserId,
      },
    }),
  ]);

  // Send notifications (non-blocking)
  const { notifyClaimApproved, notifyPreviousOwner } = await import(
    "./notification.service"
  );
  
  notifyClaimApproved(claim.userId, claim.placeId, claim.place.title).catch(
    (e) => console.error("[placeClaim] notifyClaimApproved failed:", e)
  );
  
  notifyPreviousOwner(
    claim.place.ownerUserId,
    claim.placeId,
    claim.place.title,
    claim.userId
  ).catch((e) => console.error("[placeClaim] notifyPreviousOwner failed:", e));
}

/**
 * Reject claim request
 */
export async function rejectClaimRequest(
  claimId: string,
  reviewedByUserId: string,
  reason: string
): Promise<void> {
  if (!reason?.trim()) {
    throw new Error("Reason is required for rejection");
  }

  const claim = await prisma.placeClaimRequest.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      placeId: true,
      userId: true,
      status: true,
      place: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Claim request not found");
  }

  if (claim.status !== "PENDING") {
    throw new Error(`Cannot reject claim with status: ${claim.status}`);
  }

  await prisma.$transaction([
    // Update claim status
    prisma.placeClaimRequest.update({
      where: { id: claimId },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByUserId,
        note: reason,
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: claim.placeId,
        action: "REJECT",
        message: `Claim rejected: ${reason}`,
        reviewedByUserId,
      },
    }),
  ]);

  // Send notification (non-blocking)
  const { notifyClaimRejected } = await import("./notification.service");
  notifyClaimRejected(claim.userId, claim.placeId, claim.place.title, reason).catch(
    (e) => console.error("[placeClaim] notifyClaimRejected failed:", e)
  );
}
```

---

### Phase 2: Admin API (2-3 часа)

#### 2.1 Создать admin endpoints для claims

**Файл:** `src/app/api/admin/places/claims/route.ts`

```typescript
/**
 * GET /api/admin/places/claims
 * List pending claim requests (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getPendingClaimRequests } from "@/server/services/placeClaim.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const claims = await getPendingClaimRequests(limit, offset);

    return NextResponse.json({ claims });
  } catch (error) {
    console.error("[API] Get claims error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Файл:** `src/app/api/admin/places/claims/[id]/approve/route.ts`

```typescript
/**
 * POST /api/admin/places/claims/[id]/approve
 * Approve a claim request (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { approveClaimRequest } from "@/server/services/placeClaim.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { note } = await request.json();

    await approveClaimRequest(id, user.id, note);

    return NextResponse.json({
      success: true,
      message: "Claim approved, ownership transferred",
    });
  } catch (error: any) {
    console.error("[API] Approve claim error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to approve claim" },
      { status: 400 }
    );
  }
}
```

**Файл:** `src/app/api/admin/places/claims/[id]/reject/route.ts`

```typescript
/**
 * POST /api/admin/places/claims/[id]/reject
 * Reject a claim request (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { rejectClaimRequest } from "@/server/services/placeClaim.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { reason } = await request.json();

    if (!reason?.trim()) {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 }
      );
    }

    await rejectClaimRequest(id, user.id, reason);

    return NextResponse.json({
      success: true,
      message: "Claim rejected",
    });
  } catch (error: any) {
    console.error("[API] Reject claim error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reject claim" },
      { status: 400 }
    );
  }
}
```

---

### Phase 3: Notifications (1-2 часа)

#### 3.1 Добавить notification types

**Файл:** `prisma/schema.prisma`

```prisma
enum NotificationType {
  // ... existing types ...
  
  // Place claim
  PLACE_CLAIM_APPROVED
  PLACE_CLAIM_REJECTED
  PLACE_OWNERSHIP_TRANSFERRED
}
```

#### 3.2 Добавить notification functions

**Файл:** `src/server/services/notification.service.ts`

```typescript
export async function notifyClaimApproved(
  userId: string,
  placeId: string,
  placeName: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: "PLACE_CLAIM_APPROVED",
      title: "Запрос на владение одобрен",
      message: `Ваш запрос на владение местом "${placeName}" одобрен. Теперь вы можете управлять этим местом.`,
      entityType: "PLACE",
      entityId: placeId,
    },
  });
}

export async function notifyClaimRejected(
  userId: string,
  placeId: string,
  placeName: string,
  reason: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: "PLACE_CLAIM_REJECTED",
      title: "Запрос на владение отклонен",
      message: `Ваш запрос на владение местом "${placeName}" отклонен. Причина: ${reason}`,
      entityType: "PLACE",
      entityId: placeId,
    },
  });
}

export async function notifyPreviousOwner(
  userId: string,
  placeId: string,
  placeName: string,
  newOwnerId: string
): Promise<void> {
  const newOwner = await prisma.user.findUnique({
    where: { id: newOwnerId },
    select: { displayName: true, email: true },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: "PLACE_OWNERSHIP_TRANSFERRED",
      title: "Владение местом передано",
      message: `Владение местом "${placeName}" передано пользователю ${newOwner?.displayName || newOwner?.email}. Вы больше не можете управлять этим местом.`,
      entityType: "PLACE",
      entityId: placeId,
    },
  });
}
```

---

### Phase 4: Admin UI (3-4 часа)

#### 4.1 Создать компонент для списка claims

**Файл:** `src/components/admin/places/PlaceClaimsTable.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface PlaceClaim {
  id: string;
  place: {
    id: string;
    title: string;
    owner: {
      email: string;
      displayName?: string;
    };
  };
  user: {
    id: string;
    email: string;
    displayName?: string;
  };
  business?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export function PlaceClaimsTable() {
  const [claims, setClaims] = useState<PlaceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      const response = await fetch("/api/admin/places/claims");
      const data = await response.json();
      setClaims(data.claims || []);
    } catch (error) {
      console.error("Failed to fetch claims:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (claimId: string) => {
    setApproving(claimId);
    try {
      const response = await fetch(`/api/admin/places/claims/${claimId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Approved by admin" }),
      });

      if (response.ok) {
        setClaims(claims.filter((c) => c.id !== claimId));
      } else {
        alert("Failed to approve claim");
      }
    } catch (error) {
      console.error("Error approving claim:", error);
      alert("Error approving claim");
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (claimId: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    setRejecting(claimId);
    try {
      const response = await fetch(`/api/admin/places/claims/${claimId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        setClaims(claims.filter((c) => c.id !== claimId));
      } else {
        alert("Failed to reject claim");
      }
    } catch (error) {
      console.error("Error rejecting claim:", error);
      alert("Error rejecting claim");
    } finally {
      setRejecting(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  if (claims.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No pending claims</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-4">Place</th>
            <th className="text-left p-4">Current Owner</th>
            <th className="text-left p-4">Requester</th>
            <th className="text-left p-4">Business</th>
            <th className="text-left p-4">Created</th>
            <th className="text-left p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id} className="border-b hover:bg-gray-50">
              <td className="p-4 font-medium">{claim.place.title}</td>
              <td className="p-4 text-sm">{claim.place.owner.displayName || claim.place.owner.email}</td>
              <td className="p-4 text-sm">{claim.user.displayName || claim.user.email}</td>
              <td className="p-4 text-sm">{claim.business?.name || "—"}</td>
              <td className="p-4 text-sm">{new Date(claim.createdAt).toLocaleDateString()}</td>
              <td className="p-4 space-x-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(claim.id)}
                  disabled={approving === claim.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approving === claim.id ? <Loader2 className="animate-spin" /> : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(claim.id)}
                  disabled={rejecting === claim.id}
                >
                  {rejecting === claim.id ? <Loader2 className="animate-spin" /> : "Reject"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### 4.2 Добавить страницу в admin panel

**Файл:** `src/app/admin/places/claims/page.tsx`

```typescript
import { PlaceClaimsTable } from "@/components/admin/places/PlaceClaimsTable";

export default function PlaceClaimsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Place Ownership Claims</h1>
        <p className="text-muted-foreground">Review and approve/reject place ownership requests</p>
      </div>

      <PlaceClaimsTable />
    </div>
  );
}
```

---

### Phase 5: Testing (2-3 часа)

#### 5.1 Unit tests для claim service

**Файл:** `src/server/services/__tests__/placeClaim.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/prisma";
import {
  approveClaimRequest,
  rejectClaimRequest,
  getPendingClaimRequests,
} from "../placeClaim.service";

describe("placeClaim.service", () => {
  let placeId: string;
  let userId: string;
  let claimId: string;
  let adminId: string;

  beforeEach(async () => {
    // Setup test data
    // ...
  });

  afterEach(async () => {
    // Cleanup
    // ...
  });

  it("should approve claim and transfer ownership", async () => {
    // Test logic
  });

  it("should reject claim and keep ownership", async () => {
    // Test logic
  });

  it("should get pending claims", async () => {
    // Test logic
  });
});
```

#### 5.2 Integration tests

```typescript
describe("Place Claim API", () => {
  it("POST /api/business/places/[id]/claim should create claim", async () => {
    // Test logic
  });

  it("POST /api/admin/places/claims/[id]/approve should transfer ownership", async () => {
    // Test logic
  });

  it("POST /api/admin/places/claims/[id]/reject should reject claim", async () => {
    // Test logic
  });
});
```

---

## Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Enum + Service | 1-2h | ⏳ TODO |
| 2 | Admin API | 2-3h | ⏳ TODO |
| 3 | Notifications | 1-2h | ⏳ TODO |
| 4 | Admin UI | 3-4h | ⏳ TODO |
| 5 | Testing | 2-3h | ⏳ TODO |
| **Total** | | **9-14h** | |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Ownership transfer breaks activities | High | Test that activities still work after transfer |
| Notifications not sent | Medium | Add error handling and logging |
| Admin UI not intuitive | Medium | Get feedback from admin team |
| Performance issues with large claim lists | Low | Add pagination and indexing |

---

## Success Criteria

✅ PlaceClaimRequest enum added
✅ Claim service implemented
✅ Admin endpoints working
✅ Admin UI functional
✅ Notifications sent correctly
✅ Ownership transferred successfully
✅ Tests passing
✅ No breaking changes to existing Place functionality

---

## Notes

- **No breaking changes** - existing Place functionality remains unchanged
- **Backward compatible** - PlaceClaimRequest already exists in schema
- **Minimal scope** - only integrating existing infrastructure
- **Clear ownership** - one owner per place, no co-ownership (MVP)
- **Audit trail** - all claim actions logged in ModerationLog

