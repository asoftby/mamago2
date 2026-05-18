# Discovery Signals — Quick Reference

**Location**: `src/features/discovery/signals/`  
**Status**: Foundation Phase (Architecture Readiness)  
**Impact**: Zero runtime changes

## Signal Weights at a Glance

| Signal | Weight | Category | Meaning |
|--------|--------|----------|---------|
| CARD_VIEW | 1 | PASSIVE | User saw a card |
| DETAIL_OPEN | 3 | PASSIVE | User opened details |
| SAVE | 5 | INTENT | User saved the entity |
| PLAN_ADD | 25 | INTENT | User added to plan |
| CTA_CLICK | 30 | INTERACTION | User clicked CTA |
| BOOKING_CREATED | 40 | CONVERSION | Booking started |
| BOOKING_CONFIRMED | 70 | CONVERSION | Booking confirmed |
| BOOKING_COMPLETED | 100 | CONVERSION | Booking completed |
| FEEDBACK_LEFT | 120 | QUALITY | User left feedback |

## Key Concepts

### UserEvent vs DiscoverySignal

```
UserEvent (Raw)              DiscoverySignal (Semantic)
─────────────────────────────────────────────────────
User clicked button    →     CTA_CLICK (weight: 30)
User created booking   →     BOOKING_CREATED (weight: 40)
User left feedback      →     FEEDBACK_LEFT (weight: 120)
```

### Signal Categories

- **PASSIVE**: Basic awareness (views, clicks)
- **INTENT**: Active interest (saves, plan additions)
- **INTERACTION**: Conversion precursor (CTA clicks)
- **CONVERSION**: Completed transactions (bookings)
- **QUALITY**: High-value feedback (reviews)

## Common Tasks

### Check if signal is high-intent

```typescript
import { isHighIntentSignal } from '@/features/discovery/signals';

if (isHighIntentSignal('PLAN_ADD')) {
  // User is seriously considering this
}
```

### Check if signal is a conversion

```typescript
import { isConversionSignal } from '@/features/discovery/signals';

if (isConversionSignal('BOOKING_COMPLETED')) {
  // Strong signal of user satisfaction
}
```

### Get signal weight

```typescript
import { getSignalWeight } from '@/features/discovery/signals';

const weight = getSignalWeight('BOOKING_COMPLETED'); // 100
```

### Get signal category

```typescript
import { getSignalCategory } from '@/features/discovery/signals';

const category = getSignalCategory('SAVE'); // 'INTENT'
```

### Group signals by category

```typescript
import { groupSignalsByCategory } from '@/features/discovery/signals';

const grouped = groupSignalsByCategory(signals);
const conversions = grouped.get('CONVERSION');
const intents = grouped.get('INTENT');
```

### Calculate total weight

```typescript
import { calculateTotalWeight } from '@/features/discovery/signals';

const total = calculateTotalWeight(userSignals);
```

### Sort signals by weight

```typescript
import { compareSignalsByWeight } from '@/features/discovery/signals';

signals.sort(compareSignalsByWeight); // Highest weight first
```

## Weight Philosophy

### Why These Weights?

**Passive (1-3)**: Views and clicks are abundant but indicate low intent. A user might view 100 cards but book only 1.

**Intent (5-25)**: SAVE and PLAN_ADD require deliberate action. PLAN_ADD is weighted higher because it indicates more serious consideration.

**Interaction (30)**: CTA clicks are direct precursors to conversion. Strong intent signal.

**Conversion (40-100)**: Bookings are the ultimate goal. Completed bookings are the strongest indicator of user satisfaction.

**Quality (120)**: Feedback is the rarest signal but carries the most information. Users who leave feedback are highly engaged.

### Weight Ratios

Each step represents meaningful increase in user commitment:

```
CARD_VIEW (1)
    ↓ 3x
DETAIL_OPEN (3)
    ↓ 1.7x
SAVE (5)
    ↓ 5x
PLAN_ADD (25)
    ↓ 1.2x
CTA_CLICK (30)
    ↓ 1.3x
BOOKING_CREATED (40)
    ↓ 1.75x
BOOKING_CONFIRMED (70)
    ↓ 1.4x
BOOKING_COMPLETED (100)
    ↓ 1.2x
FEEDBACK_LEFT (120)
```

## Future Aggregates (Not Yet Implemented)

These will be computed in future phases:

### Discovery Score
```
discoveryScore = 
  (passive_weight × 0.1) +
  (intent_weight × 0.3) +
  (interaction_weight × 0.4) +
  (conversion_weight × 1.0) +
  (quality_weight × 1.5)
```

### Booking Conversion Rate
```
conversionRate = 
  bookings_completed / 
  (cta_clicks + plan_adds)
```

### Completion Rate
```
completionRate = 
  bookings_completed / 
  bookings_created
```

### Feedback Score
```
feedbackScore = 
  (positive_feedback × 1.0) +
  (negative_feedback × -0.5)
```

### Repeat Booking Rate
```
repeatRate = 
  users_with_multiple_bookings / 
  total_users_booked
```

## Implementation Roadmap

| Phase | Name | Status | What |
|-------|------|--------|------|
| 1 | Foundation | ✅ Complete | Signal weights, types, utilities |
| 2 | Signal Capture | 🔮 Future | Generate signals from events |
| 3 | Aggregation | 🔮 Future | Compute entity metrics |
| 4 | Ranking | 🔮 Future | Integrate with feed ranking |
| 5 | Personalization | 🔮 Future | User preference models |
| 6 | Quality Scoring | 🔮 Future | Quality dashboards |
| 7 | Conversion Intelligence | 🔮 Future | Conversion prediction |

## Important Notes

### Current State
- ✅ Signals are defined
- ✅ Types are established
- ✅ Utilities are available
- ❌ Signals are NOT generated
- ❌ Signals are NOT stored
- ❌ Signals do NOT affect ranking
- ❌ No background jobs run

### When Signals Become Active
- Phase 2: Signals will be generated from existing events
- Phase 3: Signals will be aggregated
- Phase 4: Signals will affect ranking

### Backward Compatibility
- ✅ No changes to existing code
- ✅ No database schema changes
- ✅ No performance impact
- ✅ Can be ignored until Phase 2

## Files

```
src/features/discovery/signals/
├── discoverySignalWeights.ts    # Static weights and categories
├── types.ts                      # Type definitions
├── utils.ts                      # Pure utility functions
└── index.ts                      # Public API

docs/reports/
├── discovery-signal-architecture.md      # Full documentation
└── DISCOVERY_SIGNALS_QUICK_REFERENCE.md  # This file
```

## Related Documentation

- [Full Architecture](./discovery-signal-architecture.md)
- [Booking Module](../BOOKING_MODULE_SUMMARY.md)
- [Activity System](../development/activity-system.md)

## FAQ

**Q: Can I use these weights in my code now?**  
A: Yes, for analysis and understanding. Don't use for runtime ranking decisions (that's Phase 4).

**Q: When will signals affect ranking?**  
A: Phase 4 (future). Currently, signals are foundation only.

**Q: What if I need to add a new signal?**  
A: Add to `DISCOVERY_SIGNAL_WEIGHTS` and `SIGNAL_CATEGORIES` in `discoverySignalWeights.ts`.

**Q: Why is FEEDBACK_LEFT weighted so high?**  
A: It's the rarest signal but carries the most information. Users who leave feedback are highly engaged.

**Q: Why is PLAN_ADD weighted higher than SAVE?**  
A: PLAN_ADD indicates more serious intent. Users add to plans when actively considering booking.

**Q: Will this change the feed?**  
A: No. This is architecture readiness only. Zero runtime impact.
