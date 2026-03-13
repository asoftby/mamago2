# Commercial Layer Phase 1 - Foundation Complete ✅

**Date**: March 13, 2026  
**Status**: Foundation Complete  
**Next Phase**: Admin UI + Business UI

---

## Overview

Successfully implemented the Commercial Layer foundation for mamaGo 2.0. This is a separate domain from billing that manages commercial relationships, contracts, placements, and expiration tracking.

## Key Concepts

- **Contract ≠ Billing**: Contracts are legal agreements, billing is payment processing
- **Contract ≠ Placement**: Contracts define terms, placements control platform access
- **Placement ≠ Service Placement**: Global placement vs. specific feature access
- **Commercial Layer ≠ Billing System**: Separate domains with different concerns

---

## 1. Prisma Schema ✅

### Enums Added

```prisma
enum ContractStatus {
  DRAFT
  ACTIVE
  EXPIRING
  EXPIRED
  TERMINATED
}

enum ContractType {
  MASTER
  ADDENDUM
  OFFER
  APPENDIX
}

enum PlacementStatus {
  ACTIVE
  EXPIRING
  EXPIRED
  PAUSED
  CANCELED
}

enum PlacementSourceType {
  SUBSCRIPTION
  MANUAL
  PROMO_PACKAGE
  BONUS
}

enum ServiceEntityType {
  PLACE
  EVENT
  OFFER
  STORY
  PROMO
}

enum CommercialNotificationType {
  CONTRACT_EXPIRING
  CONTRACT_EXPIRED
  PLACEMENT_EXPIRING
  PLACEMENT_EXPIRED
  SERVICE_EXPIRING
  SERVICE_EXPIRED
}

enum CommercialNotificationStatus {
  PENDING
  SENT
  READ
  DISMISSED
}
```

### Models Added

#### BusinessContract
- Represents legal agreements between business and platform
- Fields: contractNumber, type, status, signedAt, startsAt, endsAt, autoRenew, renewalTerms, documentUrl
- Tracks contract lifecycle and renewal terms

#### BusinessPlacement
- Controls commercial access to platform
- Fields: sourceType, status, planId, startsAt, endsAt, graceUntil
- Determines if business can use premium features

#### BusinessServicePlacement
- Time-limited commercial features for specific entities
- Fields: entityType, entityId, status, startsAt, endsAt
- Examples: promo campaigns, story packages, featured events

#### CommercialNotification
- Alerts for expiring/expired commercial items
- Fields: type, status, title, message, relatedContractId, relatedPlacementId, relatedServicePlacementId
- Scheduled delivery system

---

## 2. Database Migration ✅

**Migration**: `20260312233606_add_commercial_layer`

```bash
npx prisma migrate dev --name add_commercial_layer
```

All models created successfully with proper indexes and relations.

---

## 3. Seed Data ✅

**File**: `prisma/seed-commercial.ts`

Created realistic seed data:
- 1 contract (expiring in 7 days)
- 1 placement (expiring in 7 days)
- 2 service placements (active promo + story)
- 2 commercial notifications (contract expiring + placement expiring)

**Run seed**:
```bash
npx tsx prisma/seed-commercial.ts
```

---

## 4. Service Layer ✅

### contracts.service.ts
- `getContracts(filters)` - List with filters
- `getContractById(id)` - Single contract
- `getBusinessContracts(businessId)` - Business contracts
- `createContract(input)` - Create new
- `updateContract(id, input)` - Update
- `markContractSigned(id, signedAt)` - Mark signed
- `extendContract(id, newEndsAt)` - Extend
- `terminateContract(id, reason)` - Terminate
- `getExpiringContracts(daysAhead)` - For notifications
- `getExpiredContracts()` - For cleanup
- `updateContractStatuses()` - Cron job

### placements.service.ts
- `getPlacements(filters)` - List with filters
- `getPlacementById(id)` - Single placement
- `getActivePlacement(businessId)` - Active placement
- `getBusinessPlacements(businessId)` - Business placements
- `createPlacement(input)` - Create new
- `updatePlacement(id, input)` - Update
- `extendPlacement(id, newEndsAt, newGraceUntil)` - Extend
- `pausePlacement(id, reason)` - Pause
- `cancelPlacement(id, reason)` - Cancel
- `grantGracePeriod(id, graceUntil)` - Grant grace
- `getExpiringPlacements(daysAhead)` - For notifications
- `getExpiredPlacements()` - For cleanup
- `updatePlacementStatuses()` - Cron job

### servicePlacements.service.ts
- `getServicePlacements(filters)` - List with filters
- `getServicePlacementById(id)` - Single service placement
- `getActiveServicePlacements(businessId)` - Active services
- `getBusinessServicePlacements(businessId)` - Business services
- `createServicePlacement(input)` - Create new
- `updateServicePlacement(id, input)` - Update
- `extendServicePlacement(id, newEndsAt)` - Extend
- `cancelServicePlacement(id, reason)` - Cancel
- `getExpiringServicePlacements(daysAhead)` - For notifications
- `getExpiredServicePlacements()` - For cleanup
- `updateServicePlacementStatuses()` - Cron job

### commercialNotifications.service.ts
- `getNotifications(filters)` - List with filters
- `getNotificationById(id)` - Single notification
- `getBusinessNotifications(businessId)` - Business notifications
- `getUnreadNotifications(businessId)` - Unread only
- `createNotification(input)` - Create new
- `markNotificationSent(id)` - Mark sent
- `markNotificationRead(id)` - Mark read
- `dismissNotification(id)` - Dismiss
- `getPendingNotificationsToSend()` - For cron
- `createContractExpiringNotification()` - Helper
- `createContractExpiredNotification()` - Helper
- `createPlacementExpiringNotification()` - Helper
- `createPlacementExpiredNotification()` - Helper
- `createServiceExpiringNotification()` - Helper
- `createServiceExpiredNotification()` - Helper

### commercialOverview.service.ts
- `getAdminCommercialOverview()` - Admin dashboard data
- `getBusinessesNeedingAttention()` - Businesses with issues
- `getBusinessCommercialSummary(businessId)` - Business summary
- `getExpiringItemsSummary(daysAhead)` - Expiring items
- `getExpiredItemsSummary()` - Expired items
- `getCommercialStats()` - Stats for dashboard

---

## 5. Domain Rules

### Contract Lifecycle
1. **DRAFT** → Created but not signed
2. **ACTIVE** → Signed and valid
3. **EXPIRING** → 30 days before end
4. **EXPIRED** → Past end date
5. **TERMINATED** → Manually terminated

### Placement Lifecycle
1. **ACTIVE** → Business has access
2. **EXPIRING** → 7 days before end
3. **EXPIRED** → Past end date (or grace period)
4. **PAUSED** → Temporarily suspended
5. **CANCELED** → Permanently canceled

### Service Placement Lifecycle
1. **ACTIVE** → Service is live
2. **EXPIRING** → 3 days before end
3. **EXPIRED** → Past end date
4. **CANCELED** → Manually canceled

### Notification Flow
1. **PENDING** → Scheduled, not sent
2. **SENT** → Delivered to business
3. **READ** → Business viewed
4. **DISMISSED** → Business dismissed

---

## 6. Status Update Logic (Cron Jobs)

### Contracts
- Mark as **EXPIRING**: 30 days before end
- Mark as **EXPIRED**: Past end date

### Placements
- Mark as **EXPIRING**: 7 days before end
- Mark as **EXPIRED**: Past end date AND grace period

### Service Placements
- Mark as **EXPIRING**: 3 days before end
- Mark as **EXPIRED**: Past end date

---

## 7. Files Created

### Schema & Migration
- `prisma/schema.prisma` (commercial models added at end)
- `prisma/migrations/20260312233606_add_commercial_layer/migration.sql`
- `prisma/seed-commercial.ts`

### Service Layer
- `src/server/services/commercial/contracts.service.ts`
- `src/server/services/commercial/placements.service.ts`
- `src/server/services/commercial/servicePlacements.service.ts`
- `src/server/services/commercial/commercialNotifications.service.ts`
- `src/server/services/commercial/commercialOverview.service.ts`

### Scripts
- `scripts/check-business-status.ts` (helper for debugging)

---

## 8. Next Steps (Phase 2)

### Admin UI
1. **Dashboard** (`/admin/commercial`)
   - Active/expiring/expired counts
   - Businesses needing attention
   - Quick stats

2. **Contracts Page** (`/admin/commercial/contracts`)
   - Table with filters
   - Contract details drawer
   - Create/edit/extend/terminate actions

3. **Placements Page** (`/admin/commercial/placements`)
   - Table with filters
   - Placement details drawer
   - Extend/pause/cancel/grant grace actions

4. **Service Placements Page** (`/admin/commercial/service-placements`)
   - Table with filters
   - Service details drawer
   - Extend/cancel actions

### Business UI
1. **Commercial Page** (`/business/commercial`)
   - Contract card (status, valid until, document)
   - Placement card (plan, active until, status)
   - Active services list
   - Commercial notifications/alerts

### UI Components
- `ContractStatusBadge.tsx`
- `PlacementStatusBadge.tsx`
- `CommercialAlertCard.tsx`
- `ContractTable.tsx`
- `PlacementTable.tsx`
- `ServicePlacementTable.tsx`
- `BusinessCommercialSummaryCard.tsx`
- `ContractDetailsDrawer.tsx`
- `PlacementDetailsDrawer.tsx`
- `CommercialNotificationsList.tsx`

### API Routes
- `/api/admin/commercial/contracts/*`
- `/api/admin/commercial/placements/*`
- `/api/admin/commercial/service-placements/*`
- `/api/business/commercial/summary`
- `/api/business/commercial/notifications`

---

## 9. Testing

### Verify Seed Data
```bash
npx tsx scripts/check-business-status.ts
npx tsx prisma/seed-commercial.ts
```

### Check Database
```bash
npx prisma studio
```

Navigate to:
- BusinessContract
- BusinessPlacement
- BusinessServicePlacement
- CommercialNotification

---

## 10. Key Insights

### Separation of Concerns
- **Billing**: Payment processing, subscriptions, ledger
- **Commercial**: Contracts, legal terms, platform access control
- **Service Placements**: Feature-specific time limits

### Status Automation
- Contracts: 30-day warning window
- Placements: 7-day warning + grace period support
- Services: 3-day warning (shorter lifecycle)

### Notification Strategy
- Scheduled delivery (not immediate)
- Multiple notification types
- Read/dismiss tracking
- Related entity references

---

## Summary

✅ Prisma schema with 4 new models and 7 enums  
✅ Database migration applied successfully  
✅ Realistic seed data created  
✅ 5 service layer files with full CRUD operations  
✅ Status update logic for cron jobs  
✅ Notification creation helpers  
✅ Admin and business overview aggregations  

**Foundation is complete and ready for UI implementation.**

Next: Build admin dashboard and business commercial pages.
