# Discovery Signal Architecture

**Status**: Foundation Phase (Architecture Readiness)  
**Date**: May 2026  
**Scope**: Signal weight foundation for future ranking and personalization systems

## Overview

This document describes the lightweight foundation for mamaGo's discovery signal system. This is **not** a production ranking engine, but rather the architectural groundwork for future discovery intelligence capabilities.

### What This Is

- ✅ Type-safe signal definitions
- ✅ Static signal weight configuration
- ✅ Pure utility functions for signal analysis
- ✅ Clear conceptual framework for future systems
- ✅ Foundation for ranking, personalization, and quality scoring

### What This Is NOT

- ❌ Runtime ranking changes
- ❌ Feed reordering
- ❌ Machine learning models
- ❌ Background jobs or cron tasks
- ❌ Database schema changes
- ❌ Admin dashboards
- ❌ Real-time score calculations

## Core Concepts

### UserEvent vs DiscoverySignal

This is the fundamental distinction in the architecture:

#### UserEvent (Raw Telemetry)

- **What**: Raw, immutable record of what happened
- **Example**: User clicked a button, viewed a card, created a booking
- **Characteristics**:
  - Immutable once recorded
  - No semantic meaning
  - Direct 1:1 mapping to user actions
  - Stored in analytics/telemetry systems
- **Use**: Analytics, debugging, audit trails

#### DiscoverySignal (Ranking Signal)

- **What**: Normalized, semantic representation of user intent and satisfaction
- **Example**: A completed booking is a strong signal of user satisfaction
- **Characteristics**:
  - Derived from user events
  - Carries semantic meaning for discovery
  - Weighted by importance
  - Used for ranking and personalization
  - Immutable (computed, not stored)
- **Use**: Ranking, personalization, quality scoring

### Example: Booking Flow

```
User Action (Event)          → Discovery Signal
─────────────────────────────────────────────────
Viewed card                  → CARD_VIEW (weight: 1)
Opened details               → DETAIL_OPEN (weight: 3)
Clicked "Book Now"           → CTA_CLICK (weight: 30)
Created booking              → BOOKING_CREATED (weight: 40)
Confirmed booking            → BOOKING_CONFIRMED (weight: 70)
Completed booking            → BOOKING_COMPLETED (weight: 100)
Left feedback                → FEEDBACK_LEFT (weight: 120)
```

Each signal represents a different level of user commitment and satisfaction.

## Signal Weights Philosophy

### Weight Hierarchy

Weights are assigned based on **user intent and satisfaction indicators**:

#### 1. Passive Engagement (Weight: 1-3)

- **CARD_VIEW** (1): User saw a card in the feed
  - Lowest signal strength
  - High volume, low intent
  - Indicates basic awareness only

- **DETAIL_OPEN** (3): User opened the detail page
  - Slightly higher intent than view
  - User took action to learn more
  - Still relatively passive

**Why low weights**: Views and clicks are abundant but don't indicate real intent. A user might view 100 cards but book only 1.

#### 2. Active Intent (Weight: 5-25)

- **SAVE** (5): User explicitly saved the entity
  - User marked it for later
  - Indicates genuine interest
  - Requires deliberate action

- **PLAN_ADD** (25): User added to their plan
  - Much stronger signal than save
  - User is actively planning
  - Indicates serious consideration
  - High intent to potentially book

**Why higher weights**: These require deliberate user action and indicate real interest, not passive browsing.

#### 3. Interaction (Weight: 30)

- **CTA_CLICK** (30): User clicked a call-to-action
  - User is ready to take action
  - Indicates conversion intent
  - Often leads to booking

**Why this weight**: Direct precursor to conversion, strong intent signal.

#### 4. Conversion Signals (Weight: 40-100)

- **BOOKING_CREATED** (40): User initiated a booking
  - Conversion started
  - User committed to action
  - May not complete

- **BOOKING_CONFIRMED** (70): User confirmed the booking
  - Stronger commitment
  - User passed confirmation step
  - High likelihood of completion

- **BOOKING_COMPLETED** (100): User completed the booking
  - Strongest conversion signal
  - User satisfied enough to complete
  - Indicates quality of the offering

**Why these weights**: Conversions are the ultimate goal. Completed bookings are the strongest indicator of user satisfaction and offering quality.

#### 5. Quality Signals (Weight: 120)

- **FEEDBACK_LEFT** (120): User provided feedback
  - Highest weight signal
  - User engaged enough to provide feedback
  - Indicates strong opinion (positive or negative)
  - Rarest signal (lowest volume)

**Why highest weight**: Feedback is the rarest and most valuable signal. Users who leave feedback are highly engaged and their opinion matters most.

### Weight Ratios

The weights follow a deliberate progression:

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

Each step represents a meaningful increase in user commitment and signal value.

## Signal Categories

Signals are organized into five categories:

### PASSIVE
- CARD_VIEW
- DETAIL_OPEN

**Use**: Baseline engagement metrics, reach measurement

### INTENT
- SAVE
- PLAN_ADD

**Use**: Interest indicators, personalization signals

### INTERACTION
- CTA_CLICK

**Use**: Conversion funnel analysis, intent confirmation

### CONVERSION
- BOOKING_CREATED
- BOOKING_CONFIRMED
- BOOKING_COMPLETED

**Use**: Conversion tracking, quality scoring, ranking

### QUALITY
- FEEDBACK_LEFT

**Use**: Quality assessment, reputation signals

## Future Aggregates (Not Implemented)

These aggregates will be computed in future phases:

### Discovery Score

```
discoveryScore = 
  (passive_weight × 0.1) +
  (intent_weight × 0.3) +
  (interaction_weight × 0.4) +
  (conversion_weight × 1.0) +
  (quality_weight × 1.5)
```

Used for: Feed ranking, entity quality assessment

### Booking Conversion Rate

```
conversionRate = 
  bookings_completed / 
  (cta_clicks + plan_adds)
```

Used for: Entity quality, ranking boost

### Completion Rate

```
completionRate = 
  bookings_completed / 
  bookings_created
```

Used for: User experience quality, entity reliability

### Feedback Score

```
feedbackScore = 
  (positive_feedback_count × 1.0) +
  (negative_feedback_count × -0.5)
```

Used for: Quality assessment, reputation

### Repeat Booking Rate

```
repeatRate = 
  users_with_multiple_bookings / 
  total_users_booked
```

Used for: Entity quality, user satisfaction

## Architecture

### File Structure

```
src/features/discovery/signals/
├── discoverySignalWeights.ts    # Static weights and categories
├── types.ts                      # Type definitions
├── utils.ts                      # Pure utility functions
└── index.ts                      # Public API
```

### Module Exports

#### Constants
- `DISCOVERY_SIGNAL_WEIGHTS`: Static weight map
- `SIGNAL_CATEGORIES`: Signal groupings

#### Types
- `DiscoverySignal`: Signal interface
- `HighIntentSignal`: High-intent signal type
- `ConversionSignal`: Conversion signal type
- `EntitySignalMetrics`: Aggregated metrics
- `UserSignalProfile`: User signal patterns

#### Utilities
- `getSignalWeight()`: Get weight for a signal type
- `isHighIntentSignal()`: Check if signal indicates high intent
- `isConversionSignal()`: Check if signal is a conversion
- `getSignalCategory()`: Get category for a signal
- `isPassiveSignal()`: Check if signal is passive
- `compareSignalsByWeight()`: Sort signals by weight
- `calculateTotalWeight()`: Sum signal weights
- `groupSignalsByType()`: Group signals by type
- `groupSignalsByCategory()`: Group signals by category
- `filterSignalsByCategory()`: Filter signals by category
- `getSignalTypesInCategory()`: Get types in a category

### Design Principles

1. **No Database Dependencies**: All utilities are pure functions
2. **Type Safety**: Full TypeScript support with discriminated unions
3. **Immutability**: Signals are immutable once created
4. **Composability**: Utilities can be combined for complex analysis
5. **Extensibility**: Easy to add new signal types or categories
6. **Documentation**: Clear comments explaining the "why" behind weights

## Future Roadmap

### Phase 1: Foundation (Current)
- ✅ Signal weight configuration
- ✅ Type definitions
- ✅ Utility functions
- ✅ Architecture documentation

### Phase 2: Signal Capture (Future)
- Integrate signal generation into user event handlers
- Create signal normalization layer
- Add signal validation

### Phase 3: Aggregation (Future)
- Implement entity signal metrics computation
- Create user signal profiles
- Build aggregation pipeline

### Phase 4: Ranking (Future)
- Implement discovery score calculation
- Integrate with feed ranking
- A/B test ranking changes

### Phase 5: Personalization (Future)
- Build user preference models
- Implement personalized ranking
- Create recommendation candidates

### Phase 6: Quality Scoring (Future)
- Implement quality score calculation
- Create quality dashboards
- Build quality-based ranking

### Phase 7: Conversion Intelligence (Future)
- Analyze conversion patterns
- Identify high-converting entities
- Build conversion prediction models

## Implementation Notes

### Current State

The signal system is **read-only** and **non-operational**:
- No signals are generated
- No signals are stored
- No signals affect ranking
- No background jobs run
- No database changes

### When Signals Become Active

When Phase 2 begins, signals will be generated from existing user events:
- No new events need to be created
- Existing events will be normalized into signals
- Signals will be computed on-demand (no persistence initially)

### Backward Compatibility

This foundation is fully backward compatible:
- No changes to existing code
- No changes to database schema
- No changes to user-facing features
- No performance impact

## Usage Examples

### Check Signal Type

```typescript
import { isConversionSignal, isHighIntentSignal } from '@/features/discovery/signals';

if (isConversionSignal('BOOKING_COMPLETED')) {
  // This is a strong signal
}

if (isHighIntentSignal('PLAN_ADD')) {
  // User is seriously considering this
}
```

### Get Signal Weight

```typescript
import { getSignalWeight } from '@/features/discovery/signals';

const weight = getSignalWeight('BOOKING_COMPLETED'); // 100
```

### Group Signals

```typescript
import { groupSignalsByCategory } from '@/features/discovery/signals';

const grouped = groupSignalsByCategory(signals);
const conversions = grouped.get('CONVERSION');
```

### Calculate Total Weight

```typescript
import { calculateTotalWeight } from '@/features/discovery/signals';

const total = calculateTotalWeight(userSignals); // 250
```

## FAQ

### Q: Why are these weights hardcoded?

**A**: In the foundation phase, weights are static to establish the conceptual framework. In future phases, weights may be:
- Tuned based on A/B testing
- Adjusted per entity type
- Personalized per user
- Dynamically optimized by ML models

### Q: Why is FEEDBACK_LEFT weighted so high?

**A**: Feedback is the rarest signal (lowest volume) but carries the most information. Users who leave feedback are highly engaged and their opinion is valuable for quality assessment.

### Q: Why is PLAN_ADD weighted higher than SAVE?

**A**: PLAN_ADD indicates more serious intent. Users add to plans when they're actively considering booking. SAVE is more casual ("maybe later").

### Q: When will signals affect ranking?

**A**: Not until Phase 4 (Ranking). Currently, signals are foundation only. The feed ranking is unchanged.

### Q: Can I use these weights in my code now?

**A**: Yes, but only for analysis and understanding. Don't use them for runtime calculations or ranking decisions. That comes in Phase 4.

### Q: What if I need to add a new signal type?

**A**: Add it to `DISCOVERY_SIGNAL_WEIGHTS` and `SIGNAL_CATEGORIES` in `discoverySignalWeights.ts`. Update the types in `types.ts` if needed. The utilities will work automatically.

## Related Documentation

- [User Event System](../development/user-events.md) - Raw telemetry events
- [Booking Module](../BOOKING_MODULE_SUMMARY.md) - Booking flow and events
- [Activity System](../development/activity-system.md) - User activity tracking

## Conclusion

This foundation establishes the conceptual and technical framework for discovery intelligence at mamaGo. It provides:

1. **Clear semantics**: Distinction between events and signals
2. **Type safety**: Full TypeScript support
3. **Extensibility**: Easy to add new signals or categories
4. **Documentation**: Clear explanation of weights and philosophy
5. **Readiness**: Foundation for future ranking and personalization

The system is designed to be non-invasive initially, then gradually activated as each phase is implemented.
