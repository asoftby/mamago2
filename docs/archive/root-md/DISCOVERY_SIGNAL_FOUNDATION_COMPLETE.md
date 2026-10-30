# Discovery Signal Weight Foundation — Complete

**Status**: ✅ Complete  
**Date**: May 12, 2026  
**Phase**: Architecture Readiness (Phase 1)

## Summary

Built a lightweight, non-invasive foundation for mamaGo's future discovery ranking and personalization systems. This is **pure architecture** with **zero runtime impact** on the current product.

## What Was Built

### 1. Signal Weight Configuration
**File**: `src/features/discovery/signals/discoverySignalWeights.ts`

Static weights for 8 signal types organized into 5 categories:

```
PASSIVE (1-3):
  - CARD_VIEW: 1
  - DETAIL_OPEN: 3

INTENT (5-25):
  - SAVE: 5
  - PLAN_ADD: 25

INTERACTION (30):
  - CTA_CLICK: 30

CONVERSION (40-100):
  - BOOKING_CREATED: 40
  - BOOKING_CONFIRMED: 70
  - BOOKING_COMPLETED: 100

QUALITY (120):
  - FEEDBACK_LEFT: 120
```

### 2. Type System
**File**: `src/features/discovery/signals/types.ts`

Type-safe interfaces for:
- `DiscoverySignal`: Core signal interface
- `HighIntentSignal`: High-intent discriminated type
- `ConversionSignal`: Conversion discriminated type
- `EntitySignalMetrics`: Aggregated metrics (future use)
- `UserSignalProfile`: User patterns (future use)

### 3. Utility Functions
**File**: `src/features/discovery/signals/utils.ts`

11 pure utility functions:
- `getSignalWeight()`: Get weight for a signal type
- `isHighIntentSignal()`: Type guard for high-intent signals
- `isConversionSignal()`: Type guard for conversion signals
- `getSignalCategory()`: Get category for a signal
- `isPassiveSignal()`: Check if signal is passive
- `compareSignalsByWeight()`: Sort signals by weight
- `calculateTotalWeight()`: Sum signal weights
- `groupSignalsByType()`: Group signals by type
- `groupSignalsByCategory()`: Group signals by category
- `filterSignalsByCategory()`: Filter signals by category
- `getSignalTypesInCategory()`: Get types in a category

### 4. Public API
**File**: `src/features/discovery/signals/index.ts`

Clean exports for all types and utilities.

### 5. Architecture Documentation
**File**: `docs/reports/discovery-signal-architecture.md`

Comprehensive 400+ line document covering:
- Core concepts (UserEvent vs DiscoverySignal)
- Weight philosophy and ratios
- Signal categories and use cases
- Future aggregates (not implemented)
- Architecture overview
- Implementation roadmap (7 phases)
- Usage examples
- FAQ

## Key Design Decisions

### 1. UserEvent vs DiscoverySignal Distinction

**UserEvent**: Raw telemetry (what happened)
- Immutable once recorded
- No semantic meaning
- Direct 1:1 mapping to actions
- Stored in analytics systems

**DiscoverySignal**: Normalized ranking signal (what it means)
- Derived from events
- Carries semantic meaning
- Weighted by importance
- Used for ranking/personalization

### 2. Weight Hierarchy

Weights follow user commitment progression:
- **Passive** (1-3): Basic awareness, high volume
- **Intent** (5-25): Active interest, deliberate action
- **Interaction** (30): Conversion precursor
- **Conversion** (40-100): Completed transactions
- **Quality** (120): Rare, high-value feedback

### 3. No Database Changes

- No new tables
- No schema modifications
- No persistence layer
- Pure in-memory computation

### 4. Type Safety

- Full TypeScript support
- Discriminated unions for signal types
- Type guards for runtime checks
- Compile-time safety

### 5. Pure Functions

- No side effects
- No database dependencies
- Composable utilities
- Easy to test

## What This Enables (Future)

### Phase 2: Signal Capture
- Generate signals from existing events
- Normalize user interactions
- Validate signal data

### Phase 3: Aggregation
- Compute entity signal metrics
- Build user signal profiles
- Create aggregation pipeline

### Phase 4: Ranking
- Calculate discovery scores
- Integrate with feed ranking
- A/B test ranking changes

### Phase 5: Personalization
- Build user preference models
- Implement personalized ranking
- Create recommendation candidates

### Phase 6: Quality Scoring
- Implement quality scores
- Create quality dashboards
- Build quality-based ranking

### Phase 7: Conversion Intelligence
- Analyze conversion patterns
- Identify high-converting entities
- Build conversion prediction models

## What This Does NOT Do

❌ Change feed ranking  
❌ Generate signals  
❌ Store signals  
❌ Run background jobs  
❌ Modify database schema  
❌ Implement ML models  
❌ Create admin dashboards  
❌ Calculate scores at runtime  

## Files Created

```
src/features/discovery/signals/
├── discoverySignalWeights.ts    (95 lines)
├── types.ts                      (130 lines)
├── utils.ts                      (240 lines)
└── index.ts                      (35 lines)

docs/reports/
└── discovery-signal-architecture.md (400+ lines)
```

## Usage

### Import signals module
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
  // Strong signal
}
```

### Get weight
```typescript
const weight = getSignalWeight('BOOKING_COMPLETED'); // 100
```

### Group signals
```typescript
const grouped = groupSignalsByCategory(signals);
const conversions = grouped.get('CONVERSION');
```

## Backward Compatibility

✅ **Fully backward compatible**
- No changes to existing code
- No changes to database
- No changes to user-facing features
- No performance impact
- Can be ignored until Phase 2

## Next Steps

1. **Phase 2 (Future)**: Integrate signal generation into event handlers
2. **Phase 3 (Future)**: Build aggregation pipeline
3. **Phase 4 (Future)**: Implement ranking integration
4. **Phase 5+ (Future)**: Personalization and quality scoring

## Architecture Readiness Checklist

- ✅ Signal weights defined
- ✅ Type system established
- ✅ Utility functions implemented
- ✅ Public API created
- ✅ Architecture documented
- ✅ Future roadmap defined
- ✅ No runtime changes
- ✅ No database changes
- ✅ Fully type-safe
- ✅ Pure functions only
- ✅ Backward compatible

## Conclusion

The discovery signal foundation is complete and ready for future phases. The system provides:

1. **Clear semantics**: Distinction between events and signals
2. **Type safety**: Full TypeScript support
3. **Extensibility**: Easy to add new signals
4. **Documentation**: Clear explanation of philosophy
5. **Readiness**: Foundation for ranking and personalization

The product is unchanged. The foundation is ready.
