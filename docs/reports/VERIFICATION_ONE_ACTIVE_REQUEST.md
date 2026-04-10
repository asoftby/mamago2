# One Active Improvement Request Per Place - Exact Verification

## 1. ACTIVE STATUSES

### Exact List from Schema (prisma/schema.prisma:509-514)
```prisma
enum ImprovementRequestStatus {
  OPEN          // ← ACTIVE
  IN_PROGRESS   // ← ACTIVE
  RESOLVED      // ← TERMINAL
  CANCELLED     // ← TERMINAL
}
```

### Active Statuses
- `OPEN`
- `IN_PROGRESS`

### Terminal Statuses
- `RESOLVED`
- `CANCELLED`

### Code Evidence
**File:** `src/server/services/improvementRequest.service.ts:24-28`
```typescript
where: {
  entityType,
  entityId,
  status: {
    in: [ImprovementRequestStatus.OPEN, ImprovementRequestStatus.IN_PROGRESS],
  },
}
```

**File:** `src/server/services/placeRevision.service.ts:415-421`
```typescript
const activeImprovementRequest = await prisma.improvementRequest.findFirst({
  where: {
    entityType: "PLACE",
    entityId: revision.place.id,
    status: { in: ["OPEN", "IN_PROGRESS"] },
  },
});
```

---

## 2. DUPLICATE CREATION BEHAVIOR

### Service Layer Logic
**File:** `src/server/services/improvementRequest.service.ts:67-77`
```typescript
// CRITICAL: Check if an active improvement request already exists
const existingActiveRequest = await getActiveImprovementRequestForEntity(
  entityType,
  entityId
);

if (existingActiveRequest) {
  throw new Error(
    `ACTIVE_REQUEST_EXISTS: An active improvement request already exists for this ${entityType.toLowerCase()} (ID: ${existingActiveRequest.id}). Please resolve or cancel the existing request before creating a new one.`
  );
}
```

### API Layer Logic
**File:** `src/app/api/admin/places/[id]/improvement-request/route.ts:95-103`
```typescript
// Handle the specific case where an active request already exists
if (error.message?.startsWith("ACTIVE_REQUEST_EXISTS:")) {
  return NextResponse.json(
    { 
      error: "ACTIVE_REQUEST_EXISTS",
      message: error.message.replace("ACTIVE_REQUEST_EXISTS: ", ""),
    },
    { status: 409 } // 409 Conflict
  );
}
```

### UI Behavior
**File:** `src/components/admin/moderation/ImprovementRequestForm.tsx:50-79`
```typescript
const response = await fetch(`/api/admin/places/${placeId}/improvement-request`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ severity, title, description, dueAt }),
});

if (!response.ok) {
  const data = await response.json();
  throw new Error(data.error || "Failed to create improvement request");
}

// Success: toast.success("Запрос на доработку создан");

catch (error: any) {
  toast.error(error.message || "Не удалось создать запрос");
}
```

### Exact Behavior
1. Moderator fills form and clicks submit
2. POST request sent to `/api/admin/places/[id]/improvement-request`
3. Service checks for existing active request
4. If exists: throws `ACTIVE_REQUEST_EXISTS` error
5. API catches error and returns HTTP 409 Conflict
6. UI shows toast error with message
7. No second request created in database

---

## 3. REVISION LINKING

### Exact Logic
**File:** `src/server/services/placeRevision.service.ts:415-530`
```typescript
// Check for THE active improvement request for this place (only one can exist)
const activeImprovementRequest = await prisma.improvementRequest.findFirst({
  where: {
    entityType: "PLACE",
    entityId: revision.place.id,
    status: { in: ["OPEN", "IN_PROGRESS"] },
  },
  orderBy: { createdAt: "desc" }, // Safety: get most recent if legacy data has multiple
});

// Prepare update data
const updateData: any = {
  status: "PENDING",
  submittedAt: new Date(),
};

// Link to improvement request if one exists
if (activeImprovementRequest) {
  updateData.improvementRequestId = activeImprovementRequest.id;
}

// Update revision and improvement request in a transaction
return prisma.$transaction(async (tx) => {
  // Update revision
  const updatedRevision = await tx.placeRevision.update({
    where: { id: revisionId },
    data: updateData,
  });

  // Update improvement request status to IN_PROGRESS if linked
  if (activeImprovementRequest) {
    await tx.improvementRequest.update({
      where: { id: activeImprovementRequest.id },
      data: { status: "IN_PROGRESS" },
    });
  }

  return updatedRevision;
});
```

### What Happens If No Active Request Exists
- Revision is submitted normally
- `improvementRequestId` remains `null`
- No error thrown
- Business can submit revisions without improvement requests
- This is valid behavior (not all revisions are responses to improvement requests)

---

## 4. RESOLVE FLOW

### Auto-Resolve on Revision Approval
**File:** `src/server/services/placeRevision.service.ts:710-717`
```typescript
// Auto-resolve improvement request if this revision was linked to one
if (revision.improvementRequestId) {
  try {
    const { resolveImprovementRequest } = await import("./improvementRequest.service");
    await resolveImprovementRequest(revision.improvementRequestId, revisionId);
    console.log(`[PlaceRevision] Auto-resolved improvement request: ${revision.improvementRequestId}`);
  } catch (improvementError) {
    console.error("Failed to auto-resolve improvement request:", improvementError);
    // Don't fail the approval if improvement request resolution fails
  }
}
```

**File:** `src/server/services/improvementRequest.service.ts:189-220`
```typescript
export async function resolveImprovementRequest(
  requestId: string,
  resolvedByRevisionId?: string
) {
  const request = await prisma.improvementRequest.update({
    where: { id: requestId },
    data: {
      status: ImprovementRequestStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedByRevisionId: resolvedByRevisionId || null,
    },
  });

  // Check if entity has any other active improvement requests
  const activeCount = await prisma.improvementRequest.count({
    where: {
      entityType: request.entityType,
      entityId: request.entityId,
      status: { in: [ImprovementRequestStatus.OPEN, ImprovementRequestStatus.IN_PROGRESS] },
    },
  });

  // Update entity flag if no more active requests
  if (activeCount === 0 && request.entityType === "PLACE") {
    await prisma.place.update({
      where: { id: request.entityId },
      data: { hasActiveImprovementRequests: false },
    });
  }

  return request;
}
```

### Creating New Request After Resolve
1. Improvement request status changes: `OPEN`/`IN_PROGRESS` → `RESOLVED`
2. `RESOLVED` is a terminal status (not active)
3. `getActiveImprovementRequestForEntity()` returns `null`
4. `createImprovementRequest()` allows new request creation
5. New request gets status `OPEN` (active)
6. Place now has 2 total requests: 1 RESOLVED (not active) + 1 OPEN (active)

---

## 5. LEGACY DATA HANDLING

### Exact Behavior
**If multiple active requests exist for one Place (legacy data):**

**File:** `src/server/services/improvementRequest.service.ts:24-40`
```typescript
const activeRequest = await prisma.improvementRequest.findFirst({
  where: {
    entityType,
    entityId,
    status: { in: [ImprovementRequestStatus.OPEN, ImprovementRequestStatus.IN_PROGRESS] },
  },
  orderBy: { createdAt: "desc" }, // Get most recent if somehow multiple exist (legacy data)
});
```

### Real Behavior (Not "Graceful Handling")
1. System finds ALL active requests for the Place
2. Uses `orderBy: { createdAt: "desc" }` to get MOST RECENT
3. Returns that single request
4. Other active requests remain in database untouched
5. Business revision links to most recent active request
6. Other active requests stay OPEN/IN_PROGRESS (still active)
7. Moderator must manually resolve/cancel the others

### Detection Query
```sql
SELECT "entityId", COUNT(*) as active_count
FROM "ImprovementRequest"
WHERE "entityType" = 'PLACE'
  AND status IN ('OPEN', 'IN_PROGRESS')
GROUP BY "entityId"
HAVING COUNT(*) > 1;
```

### Current State
✅ Verification script found: **0 Places with multiple active requests**

---

## 6. MANUAL VERIFICATION STEPS

### Test Case 1: Create First Request
**Steps:**
1. Find published Place with no active improvement requests
2. As admin, navigate to Place moderation view
3. Click "Create Improvement Request"
4. Fill: severity=MEDIUM, title="Test", description="Test"
5. Submit

**Expected:**
- ✅ Request created successfully
- ✅ Toast: "Запрос на доработку создан"
- ✅ Request appears with status OPEN
- ✅ API: `POST /api/admin/places/[id]/improvement-request` → 200 OK

---

### Test Case 2: Fail to Create Second Request
**Steps:**
1. Use same Place from Test Case 1 (has active request)
2. Try to create another improvement request
3. Fill form and submit

**Expected:**
- ❌ Request creation fails
- ❌ Toast: "An active improvement request already exists..."
- ❌ No second request in database
- ❌ API: `POST /api/admin/places/[id]/improvement-request` → 409 Conflict
- ❌ Response: `{ error: "ACTIVE_REQUEST_EXISTS", message: "..." }`

---

### Test Case 3: Submit Revision
**Steps:**
1. As business owner, open Place from Test Case 1
2. Edit wizard shows improvement request banner
3. Make changes (e.g., update description)
4. Submit for moderation

**Expected:**
- ✅ Revision created with status PENDING
- ✅ `PlaceRevision.improvementRequestId` = active request ID
- ✅ `ImprovementRequest.status` changes: OPEN → IN_PROGRESS
- ✅ Toast: "Изменения отправлены на модерацию"

**Database State:**
```
PlaceRevision:
  status: PENDING
  improvementRequestId: [request-id]

ImprovementRequest:
  status: IN_PROGRESS (was OPEN)
```

---

### Test Case 4: Approve Revision
**Steps:**
1. As admin, navigate to moderation queue
2. Find revision from Test Case 3
3. Review changes
4. Click "Approve"

**Expected:**
- ✅ Revision approved (status → APPROVED)
- ✅ Changes copied to Place
- ✅ Improvement request auto-resolved
- ✅ `ImprovementRequest.status` → RESOLVED
- ✅ `ImprovementRequest.resolvedByRevisionId` = revision ID
- ✅ `Place.hasActiveImprovementRequests` → false

**Database State:**
```
PlaceRevision:
  status: APPROVED
  reviewedAt: [timestamp]

ImprovementRequest:
  status: RESOLVED
  resolvedAt: [timestamp]
  resolvedByRevisionId: [revision-id]
```

---

### Test Case 5: Create New Request After Resolve
**Steps:**
1. Use same Place from Test Case 4
2. Verify improvement request is RESOLVED
3. Try to create new improvement request
4. Fill form and submit

**Expected:**
- ✅ New request created successfully
- ✅ Previous request remains RESOLVED
- ✅ New request has status OPEN
- ✅ Place now has 1 active request (the new one)
- ✅ API: `POST /api/admin/places/[id]/improvement-request` → 200 OK

**Database State:**
```
Place has 2 improvement requests:
  - Old request: status RESOLVED (not active)
  - New request: status OPEN (active)
```

---

### Test Case 6: Check Active Request API
**API Call:**
```
GET /api/admin/places/[id]/improvement-request?activeOnly=true
```

**Expected (with active request):**
```json
{
  "hasActiveRequest": true,
  "activeRequest": { "id": "...", "status": "OPEN", "title": "..." }
}
```

**Expected (without active request):**
```json
{
  "hasActiveRequest": false,
  "activeRequest": null
}
```

---

## VERIFICATION SUMMARY

✅ **Active statuses:** OPEN, IN_PROGRESS (exactly 2)  
✅ **Terminal statuses:** RESOLVED, CANCELLED (exactly 2)  
✅ **Duplicate prevention:** Service layer throws error, API returns 409, UI shows toast  
✅ **Revision linking:** Automatic to single active request, null if none exists  
✅ **Auto-resolve:** Approving revision resolves linked request  
✅ **New request after resolve:** Allowed (resolved is terminal, not active)  
✅ **Legacy data:** Uses most recent active request via orderBy  
✅ **Current database:** 0 Places with multiple active requests  

**Verification script:** `scripts/verify-one-active-request-rule.ts`  
**Run:** `npx tsx scripts/verify-one-active-request-rule.ts`
