# Discovery Signals — Visual Guide

## Signal Weight Hierarchy

```
                    FEEDBACK_LEFT (120)
                           ▲
                           │ 1.2x
                           │
                    BOOKING_COMPLETED (100)
                           ▲
                           │ 1.4x
                           │
                    BOOKING_CONFIRMED (70)
                           ▲
                           │ 1.75x
                           │
                    BOOKING_CREATED (40)
                           ▲
                           │ 1.3x
                           │
                      CTA_CLICK (30)
                           ▲
                           │ 1.2x
                           │
                      PLAN_ADD (25)
                           ▲
                           │ 5x
                           │
                        SAVE (5)
                           ▲
                           │ 1.7x
                           │
                    DETAIL_OPEN (3)
                           ▲
                           │ 3x
                           │
                    CARD_VIEW (1)
```

## User Journey & Signals

```
User Browsing Feed
        │
        ├─→ CARD_VIEW (1)
        │   └─→ User sees card in feed
        │
        ├─→ DETAIL_OPEN (3)
        │   └─→ User clicks to see details
        │
        ├─→ SAVE (5)
        │   └─→ User bookmarks for later
        │
        ├─→ PLAN_ADD (25)
        │   └─→ User adds to their plan
        │
        ├─→ CTA_CLICK (30)
        │   └─→ User clicks "Book Now"
        │
        ├─→ BOOKING_CREATED (40)
        │   └─→ Booking form submitted
        │
        ├─→ BOOKING_CONFIRMED (70)
        │   └─→ User confirmed booking
        │
        ├─→ BOOKING_COMPLETED (100)
        │   └─→ Booking completed
        │
        └─→ FEEDBACK_LEFT (120)
            └─→ User left review/feedback
```

## Signal Categories

```
┌─────────────────────────────────────────────────────────────┐
│                    DISCOVERY SIGNALS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PASSIVE (1-3)          INTENT (5-25)      INTERACTION (30) │
│  ─────────────          ─────────────      ────────────────│
│  • CARD_VIEW (1)        • SAVE (5)         • CTA_CLICK (30) │
│  • DETAIL_OPEN (3)      • PLAN_ADD (25)                     │
│                                                             │
│  CONVERSION (40-100)    QUALITY (120)                       │
│  ──────────────────     ──────────────                      │
│  • BOOKING_CREATED (40) • FEEDBACK_LEFT (120)               │
│  • BOOKING_CONFIRMED    (Highest value)                     │
│  • BOOKING_COMPLETED                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Signal Strength vs Volume

```
Signal Weight
    │
120 │                                    ● FEEDBACK_LEFT
    │
100 │                            ● BOOKING_COMPLETED
    │
 70 │                        ● BOOKING_CONFIRMED
    │
 40 │                    ● BOOKING_CREATED
    │
 30 │                ● CTA_CLICK
    │
 25 │            ● PLAN_ADD
    │
  5 │        ● SAVE
    │
  3 │    ● DETAIL_OPEN
    │
  1 │ ● CARD_VIEW
    │
    └────────────────────────────────────────────────────────
      Low Volume                              High Volume
      High Value                              Low Value
```

## Signal Generation Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    USER EVENT (Raw)                          │
│  • Immutable telemetry                                       │
│  • No semantic meaning                                       │
│  • Direct 1:1 mapping to action                              │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              DISCOVERY SIGNAL (Normalized)                   │
│  • Semantic meaning                                          │
│  • Weighted by importance                                    │
│  • Used for ranking/personalization                          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              FUTURE: AGGREGATION & SCORING                   │
│  • Entity signal metrics                                     │
│  • Discovery scores                                          │
│  • Conversion rates                                          │
│  • Quality scores                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│         FUTURE: RANKING & PERSONALIZATION                    │
│  • Feed ranking                                              │
│  • Personalized recommendations                              │
│  • Quality-based sorting                                     │
└──────────────────────────────────────────────────────────────┘
```

## Signal Categories & Use Cases

```
┌─────────────────────────────────────────────────────────────┐
│ PASSIVE (CARD_VIEW, DETAIL_OPEN)                            │
├─────────────────────────────────────────────────────────────┤
│ Use: Baseline engagement, reach measurement                 │
│ Characteristics: High volume, low intent                    │
│ Example: 1000 views, 100 detail opens                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ INTENT (SAVE, PLAN_ADD)                                     │
├─────────────────────────────────────────────────────────────┤
│ Use: Interest indicators, personalization                   │
│ Characteristics: Deliberate action, medium volume           │
│ Example: 20 saves, 5 plan additions                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ INTERACTION (CTA_CLICK)                                     │
├─────────────────────────────────────────────────────────────┤
│ Use: Conversion funnel analysis, intent confirmation        │
│ Characteristics: Direct conversion precursor                │
│ Example: 3 CTA clicks                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CONVERSION (BOOKING_CREATED/CONFIRMED/COMPLETED)            │
├─────────────────────────────────────────────────────────────┤
│ Use: Conversion tracking, quality scoring, ranking          │
│ Characteristics: Completed transactions, low volume         │
│ Example: 1 booking created, 1 confirmed, 1 completed       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ QUALITY (FEEDBACK_LEFT)                                     │
├─────────────────────────────────────────────────────────────┤
│ Use: Quality assessment, reputation signals                 │
│ Characteristics: Rarest, highest value                      │
│ Example: 1 feedback (5-star review)                         │
└─────────────────────────────────────────────────────────────┘
```

## Future Aggregates (Roadmap)

```
Phase 2: Signal Capture
    │
    ├─→ Generate signals from events
    ├─→ Normalize interactions
    └─→ Validate signal data
         │
         ▼
Phase 3: Aggregation
    │
    ├─→ Entity Signal Metrics
    │   ├─ Total weight
    │   ├─ Unique users
    │   └─ By category/type
    │
    ├─→ User Signal Profile
    │   ├─ Total signals
    │   ├─ Category distribution
    │   └─ Signal intensity
    │
    └─→ Aggregation Pipeline
         │
         ▼
Phase 4: Ranking
    │
    ├─→ Discovery Score
    │   └─ Weighted combination of all signals
    │
    ├─→ Booking Conversion Rate
    │   └─ Bookings / (CTAs + Plans)
    │
    └─→ Feed Ranking Integration
         │
         ▼
Phase 5: Personalization
    │
    ├─→ User Preference Models
    ├─→ Personalized Ranking
    └─→ Recommendation Candidates
         │
         ▼
Phase 6: Quality Scoring
    │
    ├─→ Quality Score Calculation
    ├─→ Quality Dashboards
    └─→ Quality-based Ranking
         │
         ▼
Phase 7: Conversion Intelligence
    │
    ├─→ Conversion Pattern Analysis
    ├─→ High-Converting Entity Identification
    └─→ Conversion Prediction Models
```

## Weight Distribution Example

```
User A's Signals:
─────────────────

CARD_VIEW (1)           ████ (4 signals)
DETAIL_OPEN (3)         ██ (2 signals)
SAVE (5)                █ (1 signal)
PLAN_ADD (25)           █ (1 signal)
CTA_CLICK (30)          █ (1 signal)
BOOKING_CREATED (40)    █ (1 signal)
BOOKING_CONFIRMED (70)  █ (1 signal)
BOOKING_COMPLETED (100) █ (1 signal)
FEEDBACK_LEFT (120)     █ (1 signal)

Total Weight Calculation:
─────────────────────────
(4 × 1) + (2 × 3) + (1 × 5) + (1 × 25) + (1 × 30) + 
(1 × 40) + (1 × 70) + (1 × 100) + (1 × 120) = 393

Signal Distribution:
────────────────────
Passive:    6 signals (4 + 2)      = 10 weight
Intent:     2 signals (1 + 1)      = 30 weight
Interaction: 1 signal              = 30 weight
Conversion: 3 signals              = 210 weight
Quality:    1 signal               = 120 weight
                                   ─────────────
                        Total:     400 weight
```

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                         │
│  (Feed ranking, personalization, recommendations)           │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│              DISCOVERY INTELLIGENCE LAYER                    │
│  (Scoring, aggregation, analysis)                           │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│              DISCOVERY SIGNAL LAYER (Current)               │
│  • Signal weights                                           │
│  • Signal types                                             │
│  • Signal utilities                                         │
│  • Signal categories                                        │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                    EVENT LAYER                              │
│  (Raw user events, telemetry)                               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Status

```
Phase 1: Foundation ✅ COMPLETE
├─ Signal weights defined
├─ Type system established
├─ Utility functions implemented
├─ Public API created
└─ Architecture documented

Phase 2: Signal Capture 🔮 FUTURE
├─ Generate signals from events
├─ Normalize interactions
└─ Validate signal data

Phase 3: Aggregation 🔮 FUTURE
├─ Entity signal metrics
├─ User signal profiles
└─ Aggregation pipeline

Phase 4: Ranking 🔮 FUTURE
├─ Discovery score calculation
├─ Feed ranking integration
└─ A/B testing

Phase 5: Personalization 🔮 FUTURE
├─ User preference models
├─ Personalized ranking
└─ Recommendations

Phase 6: Quality Scoring 🔮 FUTURE
├─ Quality score calculation
├─ Quality dashboards
└─ Quality-based ranking

Phase 7: Conversion Intelligence 🔮 FUTURE
├─ Conversion pattern analysis
├─ High-converting entity identification
└─ Conversion prediction
```

## Key Takeaways

1. **Signals are semantic**: They carry meaning about user intent and satisfaction
2. **Weights follow commitment**: Higher weights for stronger user commitment
3. **Categories organize signals**: Five categories for different use cases
4. **Foundation is ready**: Architecture is in place for future phases
5. **Zero impact now**: Current product is completely unchanged
6. **Extensible design**: Easy to add new signals or categories
7. **Type-safe**: Full TypeScript support throughout
8. **Pure functions**: No side effects, easy to test and compose
