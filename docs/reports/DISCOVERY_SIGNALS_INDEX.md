# Discovery Signals — Complete Index

**Status**: ✅ Foundation Phase Complete  
**Date**: May 12, 2026  
**Impact**: Zero runtime changes

## Quick Navigation

### For Quick Understanding
- **Start here**: [Quick Reference](./DISCOVERY_SIGNALS_QUICK_REFERENCE.md) — 5-minute overview
- **Visual learner**: [Visual Guide](./DISCOVERY_SIGNALS_VISUAL_GUIDE.md) — Diagrams and flows

### For Deep Dive
- **Full documentation**: [Architecture](./discovery-signal-architecture.md) — Complete technical guide
- **Implementation**: [Code](../../src/features/discovery/signals/) — TypeScript implementation

### For Project Context
- **Summary**: [Foundation Complete](../../DISCOVERY_SIGNAL_FOUNDATION_COMPLETE.md) — What was built
- **Text summary**: [Summary](../../DISCOVERY_SIGNAL_FOUNDATION_SUMMARY.txt) — Plain text overview

## What Was Built

### Code (4 files, 500 lines)

```
src/features/discovery/signals/
├── discoverySignalWeights.ts    # Static weights and categories
├── types.ts                      # Type definitions
├── utils.ts                      # Pure utility functions
└── index.ts                      # Public API
```

### Documentation (4 files, 1000+ lines)

```
docs/reports/
├── discovery-signal-architecture.md      # Full technical guide
├── DISCOVERY_SIGNALS_QUICK_REFERENCE.md  # Quick reference
├── DISCOVERY_SIGNALS_VISUAL_GUIDE.md     # Diagrams and flows
└── DISCOVERY_SIGNALS_INDEX.md            # This file
```

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

**UserEvent** (Raw Telemetry)
- What happened
- Immutable once recorded
- No semantic meaning
- Direct 1:1 mapping to action

**DiscoverySignal** (Ranking Signal)
- What it means for discovery
- Derived from events
- Carries semantic meaning
- Weighted by importance

### Signal Categories

- **PASSIVE**: Basic awareness (views, clicks)
- **INTENT**: Active interest (saves, plan additions)
- **INTERACTION**: Conversion precursor (CTA clicks)
- **CONVERSION**: Completed transactions (bookings)
- **QUALITY**: High-value feedback (reviews)

## Usage Examples

### Import the module
```typescript
import {
  DISCOVERY_SIGNAL_WEIGHTS,
  getSignalWeight,
  isConversionSignal,
  groupSignalsByCategory,
} from '@/features/discovery/signals';
```

### Check signal type
```typescript
if (isConversionSignal('BOOKING_COMPLETED')) {
  // Strong signal of user satisfaction
}
```

### Get signal weight
```typescript
const weight = getSignalWeight('BOOKING_COMPLETED'); // 100
```

### Group signals
```typescript
const grouped = groupSignalsByCategory(signals);
const conversions = grouped.get('CONVERSION');
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

## Utilities Available

### Type Guards
- `isHighIntentSignal()` — Check if signal indicates high intent
- `isConversionSignal()` — Check if signal is a conversion
- `isPassiveSignal()` — Check if signal is passive

### Analysis
- `getSignalWeight()` — Get weight for a signal type
- `getSignalCategory()` — Get category for a signal
- `calculateTotalWeight()` — Sum signal weights
- `compareSignalsByWeight()` — Sort signals by weight

### Grouping
- `groupSignalsByType()` — Group signals by type
- `groupSignalsByCategory()` — Group signals by category
- `filterSignalsByCategory()` — Filter signals by category
- `getSignalTypesInCategory()` — Get types in a category

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

## Reading Guide

### 5-Minute Overview
1. Read this file (you're here)
2. Check [Quick Reference](./DISCOVERY_SIGNALS_QUICK_REFERENCE.md)
3. Look at the signal weights table above

### 15-Minute Understanding
1. Read [Quick Reference](./DISCOVERY_SIGNALS_QUICK_REFERENCE.md)
2. Review [Visual Guide](./DISCOVERY_SIGNALS_VISUAL_GUIDE.md)
3. Check the code in `src/features/discovery/signals/`

### Complete Deep Dive
1. Read [Architecture](./discovery-signal-architecture.md)
2. Review [Visual Guide](./DISCOVERY_SIGNALS_VISUAL_GUIDE.md)
3. Study the code in `src/features/discovery/signals/`
4. Read [Foundation Complete](../../DISCOVERY_SIGNAL_FOUNDATION_COMPLETE.md)

## Related Documentation

- [Booking Module](../BOOKING_MODULE_SUMMARY.md) — Booking flow and events
- [Activity System](../development/activity-system.md) — User activity tracking
- [User Events](../development/user-events.md) — Raw telemetry events

## Summary

The discovery signal foundation is complete and ready for future phases. The system provides:

1. **Clear semantics**: Distinction between events and signals
2. **Type safety**: Full TypeScript support
3. **Extensibility**: Easy to add new signals
4. **Documentation**: Clear explanation of philosophy
5. **Readiness**: Foundation for ranking and personalization

The product is unchanged. The foundation is ready.

---

**Last Updated**: May 12, 2026  
**Status**: ✅ Complete  
**Next Phase**: Signal Capture (Future)
